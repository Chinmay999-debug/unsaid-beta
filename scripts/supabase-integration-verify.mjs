/**
 * Loads .env and verifies Supabase backend: tables, counts, auth, RLS-ish flows.
 * Run: node scripts/supabase-integration-verify.mjs
 */
import "dotenv/config";
import "./supabase-node-ws-polyfill.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

const report = { ok: true, steps: [], errors: [] };

function log(step, detail) {
  report.steps.push({ step, detail });
  console.log(`[${step}]`, detail ?? "");
}

function fail(step, err) {
  report.ok = false;
  const msg = err?.message ?? String(err);
  report.errors.push({ step, msg });
  console.error(`[FAIL:${step}]`, msg);
}

async function main() {
  if (!url || !serviceKey) {
    fail("env", new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"));
    process.exit(1);
  }
  if (!publishableKey) {
    fail("env", new Error("Missing SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)"));
    process.exit(1);
  }

  log("connection", `URL host: ${new URL(url).host}`);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });

  /** PostgREST probe column per table (match_skips has composite PK, no `id`). */
  const tableProbeSelect = {
    profiles: "id",
    conversations: "id",
    messages: "id",
    ai_messages: "id",
    match_skips: "user_id,skipped_user_id",
  };

  const tables = Object.keys(tableProbeSelect);
  const counts = {};
  for (const t of tables) {
    const cols = tableProbeSelect[t];
    const probe = await admin.from(t).select(cols).limit(1);
    if (probe.error) {
      fail(`table:${t}`, probe.error);
      counts[t] = null;
    } else {
      const { count, error: cErr } = await admin
        .from(t)
        .select("*", { count: "exact", head: true });
      if (cErr) {
        fail(`table:${t}:count`, cErr);
        counts[t] = null;
      } else {
        counts[t] = count ?? 0;
        log(`table:${t}`, `ok, rows (estimate): ${count ?? 0}`);
      }
    }
  }

  const anon = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });

  const testEmail = `verify-ci-${Date.now()}@unsaid.com`;
  const testPassword = "verify-local-pass-99";

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (createErr) {
    fail("auth.admin.createUser", createErr);
    console.log("\n--- SUMMARY ---");
    console.log(JSON.stringify({ ok: false, counts, errors: report.errors }, null, 2));
    process.exit(1);
  }
  log("auth.admin.createUser", created?.user?.id ? `user ${created.user.id}` : "no user");

  let userId = created?.user?.id ?? null;

  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInErr) {
    fail("auth.signInWithPassword", signInErr);
  } else {
    log("auth.signInWithPassword", signIn?.session?.access_token ? "session ok" : "no session");
  }

  const session = signIn?.session;

  try {
    if (userId && session) {
      const userClient = createClient(url, publishableKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          },
        },
      });
      await userClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      const { data: prof, error: pErr } = await userClient
        .from("profiles")
        .select("id,username")
        .eq("id", userId)
        .maybeSingle();
      if (pErr) fail("profiles.select_self", pErr);
      else
        log(
          "profiles.select_self",
          prof ? `username=${prof.username}` : "no row (trigger may be delayed)",
        );

      const { error: aiErr } = await userClient.from("ai_messages").insert({
        user_id: userId,
        role: "user",
        content: "__verify_ai_persistence__",
      });
      if (aiErr) fail("ai_messages.insert", aiErr);
      else log("ai_messages.insert", "ok");

      const { data: aiRows, error: aiSelErr } = await userClient
        .from("ai_messages")
        .select("id")
        .eq("user_id", userId)
        .eq("content", "__verify_ai_persistence__")
        .limit(1);
      if (aiSelErr) fail("ai_messages.select", aiSelErr);
      else log("ai_messages.select", aiRows?.length ? "persisted" : "not found");

      await admin
        .from("ai_messages")
        .delete()
        .eq("user_id", userId)
        .eq("content", "__verify_ai_persistence__");

      const other = await admin
        .from("profiles")
        .select("id")
        .neq("id", userId)
        .limit(1)
        .maybeSingle();
      if (other.data?.id) {
        const otherId = other.data.id;
        const [a, b] = [userId, otherId].sort();
        const { data: conv, error: cErr } = await userClient
          .from("conversations")
          .insert({ user_a: a, user_b: b, intro: "__verify__" })
          .select("id")
          .single();
        if (cErr) fail("conversations.insert", cErr);
        else {
          log("conversations.insert", conv.id);
          const { error: mErr } = await userClient.from("messages").insert({
            conversation_id: conv.id,
            sender_id: userId,
            content: "__verify_dm__",
          });
          if (mErr) fail("messages.insert", mErr);
          else log("messages.insert", "ok");

          const { data: convRow } = await admin
            .from("conversations")
            .select("last_message_at")
            .eq("id", conv.id)
            .single();
          log("trigger:last_message_at", convRow?.last_message_at ? "updated" : "unknown");

          const { data: msgRows, error: msgReadErr } = await userClient
            .from("messages")
            .select("id,content")
            .eq("conversation_id", conv.id)
            .eq("content", "__verify_dm__")
            .limit(1);
          if (msgReadErr) fail("messages.select_roundtrip", msgReadErr);
          else
            log(
              "messages.select_roundtrip",
              msgRows?.length ? "inbox read ok" : "message not visible to participant",
            );

          await admin.from("messages").delete().eq("conversation_id", conv.id);
          await admin.from("conversations").delete().eq("id", conv.id);
        }

        const { error: skipInsErr } = await userClient.from("match_skips").insert({
          user_id: userId,
          skipped_user_id: otherId,
        });
        if (skipInsErr) fail("match_skips.insert", skipInsErr);
        else log("match_skips.insert", "ok");

        const { data: skipRow, error: skipSelErr } = await userClient
          .from("match_skips")
          .select("skipped_user_id")
          .eq("user_id", userId)
          .eq("skipped_user_id", otherId)
          .maybeSingle();
        if (skipSelErr) fail("match_skips.select", skipSelErr);
        else log("match_skips.select", skipRow ? "skip persisted" : "skip row missing");

        await admin
          .from("match_skips")
          .delete()
          .eq("user_id", userId)
          .eq("skipped_user_id", otherId);
      } else {
        log("inbox.skip", "no second profile for DM round-trip (seed ghosts first)");
      }
    } else if (userId && !session) {
      log("auth.session", "no session after sign-in");
    }
  } finally {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
      log("cleanup", "deleted test user");
    }
  }

  console.log("\n--- SUMMARY ---");
  console.log(JSON.stringify({ ok: report.ok, counts, errors: report.errors }, null, 2));
  process.exit(report.ok ? 0 : 1);
}

await main();
