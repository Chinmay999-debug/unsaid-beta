import "dotenv/config";
import "./supabase-node-ws-polyfill.mjs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env before seeding.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
});

const now = Date.now();
const mins = (n) => n * 60_000;
const hours = (n) => n * 60 * 60_000;
const days = (n) => n * 24 * 60 * 60_000;
const iso = (t) => new Date(t).toISOString();

const RESET = process.argv.includes("--reset");
const SEED_TARGET_USER_EMAIL = (process.env.SEED_TARGET_USER_EMAIL || "").trim().toLowerCase();

const GHOSTS = [
  {
    username: "QuietOrbit",
    intro: "trying to reconnect with people without pretending all the time.",
    firstMessage: "do you ever feel disconnected even when you’re around people?",
    vibe: "thoughtful, calm, introspective",
    // stable-but-abstract seed for Orb
    avatar_seed: "quiet-orbit",
    // keep them recently active, but not identical timestamps
    last_active_ms: now - mins(6),
    email: "quietorbit@unsaid.local",
  },
  {
    username: "VelvetSignal",
    intro: "usually awake too late thinking about life and music.",
    firstMessage: "what’s a song that feels like your current life?",
    vibe: "creative, night owl, soft-spoken",
    avatar_seed: "velvet-signal",
    last_active_ms: now - mins(3),
    email: "velvetsignal@unsaid.local",
  },
  {
    username: "HollowBloom",
    intro: "building things while slowly disconnecting from everyone.",
    firstMessage: "what’s something you’ve been keeping to yourself lately?",
    vibe: "founder energy, overthinker, emotionally tired",
    avatar_seed: "hollow-bloom",
    last_active_ms: now - mins(11),
    email: "hollowbloom@unsaid.local",
  },
  {
    username: "SilentCurrent",
    intro: "trying to be honest without being loud about it.",
    firstMessage: "what's one thing you've been feeling but not saying?",
    vibe: "quiet, sincere, emotionally present",
    avatar_seed: "silent-current",
    last_active_ms: now - mins(8),
    email: "silentcurrent@unsaid.local",
  },
  {
    username: "CobaltHour",
    intro: "in a rebuilding season, one small conversation at a time.",
    firstMessage: "what part of your week felt heavy?",
    vibe: "gentle, grounded, late-night clarity",
    avatar_seed: "cobalt-hour",
    last_active_ms: now - mins(4),
    email: "cobalthour@unsaid.local",
  },
];

async function getOrCreateGhostUser({ email, username }) {
  // Prefer profile lookup (username is unique and visible in DB)
  const { data: prof } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle();

  if (prof?.id) return prof.id;

  // Create auth user (this will trigger handle_new_user -> profiles row)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    // Simple local password so you *can* log in as them if needed.
    // Keep it consistent but not guessable from UI.
    password: `unsaid_${username}_local_beta_42`,
    user_metadata: { seed_type: "ghost" },
  });
  if (error) throw error;
  if (!data?.user?.id) throw new Error(`Failed to create ghost user ${username}`);
  return data.user.id;
}

async function upsertProfile(id, ghost) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id,
      username: ghost.username,
      avatar_seed: ghost.avatar_seed,
      context_summary: ghost.intro,
      last_active: iso(ghost.last_active_ms),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

function pair(a, b) {
  return a < b ? [a, b] : [b, a];
}

async function findUserIdByEmail(email) {
  if (!email) return null;
  const target = email.trim().toLowerCase();

  // Supabase Admin API doesn't expose a direct "getUserByEmail" in all setups,
  // so we page through users (fast enough for local/beta).
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit?.id) return hit.id;
    if (users.length < 200) break;
  }
  return null;
}

async function getOrCreateConversation(a, b, intro, createdAtMs) {
  const [user_a, user_b] = pair(a, b);

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      user_a,
      user_b,
      intro,
      created_at: iso(createdAtMs),
      last_message_at: iso(createdAtMs),
    })
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
}

async function conversationHasMessages(conversationId) {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function insertMessages(conversationId, rows) {
  const { error } = await supabase.from("messages").insert(rows);
  if (error) throw error;
}

async function resetGhostData(ghostIds) {
  // delete messages in any conversations involving ghost ids, then conversations.
  // (profiles/auth users remain; this is safe and fast for reruns)
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, user_a, user_b")
    .or(`user_a.in.(${ghostIds.join(",")}),user_b.in.(${ghostIds.join(",")})`);

  const convIds = (convs ?? []).map((c) => c.id);
  if (convIds.length) {
    await supabase.from("messages").delete().in("conversation_id", convIds);
    await supabase.from("conversations").delete().in("id", convIds);
  }
}

async function main() {
  // Create/ensure users + profiles
  const ghostIds = {};
  for (const g of GHOSTS) {
    const id = await getOrCreateGhostUser(g);
    ghostIds[g.username] = id;
    await upsertProfile(id, g);
  }

  const ids = Object.values(ghostIds);

  if (RESET) {
    await resetGhostData(ids);
  }

  // Optional: seed "alive" inbox threads for a main tester account
  let testerId = null;
  if (SEED_TARGET_USER_EMAIL) {
    testerId = await findUserIdByEmail(SEED_TARGET_USER_EMAIL);
    if (!testerId) {
      console.warn(
        `SEED_TARGET_USER_EMAIL set but no user found for "${SEED_TARGET_USER_EMAIL}". Log in once to create the account, then rerun.`,
      );
    }
  }

  // Ghost-to-ghost conversations (so the world feels lived-in)
  const conv1At = now - mins(90);
  const conv2At = now - mins(210);

  const conv1 = await getOrCreateConversation(
    ghostIds.QuietOrbit,
    ghostIds.VelvetSignal,
    "two people, both a little tired of pretending.",
    conv1At,
  );
  const conv2 = await getOrCreateConversation(
    ghostIds.VelvetSignal,
    ghostIds.HollowBloom,
    "somewhere between ambition and loneliness, you both paused.",
    conv2At,
  );

  // Seed message threads once (avoid duplicates on rerun)
  if (!(await conversationHasMessages(conv1))) {
    await insertMessages(conv1, [
      {
        conversation_id: conv1,
        sender_id: ghostIds.QuietOrbit,
        content: "do you ever feel disconnected even when you’re around people?",
        created_at: iso(conv1At + mins(4)),
      },
      {
        conversation_id: conv1,
        sender_id: ghostIds.VelvetSignal,
        content:
          "yeah. like my body shows up, but my mind is halfway somewhere else. does it happen more when you’re tired or all the time?",
        created_at: iso(conv1At + mins(9)),
      },
      {
        conversation_id: conv1,
        sender_id: ghostIds.QuietOrbit,
        content:
          "mostly when i’ve been “on” too long. i start feeling like i’m watching myself talk.",
        created_at: iso(conv1At + mins(16)),
      },
      {
        conversation_id: conv1,
        sender_id: ghostIds.VelvetSignal,
        content:
          "i get that. sometimes i put headphones on just to have something honest in the room with me.",
        created_at: iso(conv1At + mins(23)),
      },
    ]);
  }

  if (!(await conversationHasMessages(conv2))) {
    await insertMessages(conv2, [
      {
        conversation_id: conv2,
        sender_id: ghostIds.HollowBloom,
        content: "i keep building things and it’s weird how easy it is to stop noticing people.",
        created_at: iso(conv2At + mins(6)),
      },
      {
        conversation_id: conv2,
        sender_id: ghostIds.VelvetSignal,
        content:
          "what part of it feels like disconnection — the pace, the pressure, or the silence after?",
        created_at: iso(conv2At + mins(13)),
      },
      {
        conversation_id: conv2,
        sender_id: ghostIds.HollowBloom,
        content:
          "the silence after. like i finally stop and realize i haven’t actually talked to anyone in days.",
        created_at: iso(conv2At + mins(19)),
      },
      {
        conversation_id: conv2,
        sender_id: ghostIds.VelvetSignal,
        content:
          "that’s real. if you could ask for one kind of company right now, what would it be like?",
        created_at: iso(conv2At + mins(28)),
      },
    ]);
  }

  if (testerId) {
    const threads = [
      {
        ghost: "QuietOrbit",
        createdAt: now - days(3) - hours(2),
        intro: "a quiet thread that didn't need much explaining.",
        messages: [
          // ghost opens with provided sample
          (t) => ({
            sender_id: ghostIds.QuietOrbit,
            content: "do you ever feel disconnected even when you’re around people?",
            created_at: iso(t + mins(18)),
          }),
          (t) => ({
            sender_id: testerId,
            content: "yeah. it happens even with friends sometimes. like i’m there but not really.",
            created_at: iso(t + mins(34)),
          }),
          (t) => ({
            sender_id: ghostIds.QuietOrbit,
            content:
              "same. i keep wondering if it’s exhaustion or just… distance building up quietly.",
            created_at: iso(t + mins(58)),
          }),
          (t) => ({
            sender_id: testerId,
            content: "distance building up quietly is exactly it.",
            created_at: iso(t + mins(74)),
          }),
        ],
      },
      {
        ghost: "VelvetSignal",
        createdAt: now - days(1) - hours(5),
        intro: "music as a small, steady bridge.",
        messages: [
          (t) => ({
            sender_id: ghostIds.VelvetSignal,
            content: "been awake way too late lately honestly",
            created_at: iso(t + mins(9)),
          }),
          (t) => ({
            sender_id: testerId,
            content: "same. what keeps you up?",
            created_at: iso(t + mins(21)),
          }),
          (t) => ({
            sender_id: ghostIds.VelvetSignal,
            content: "music has been carrying my mood recently. and the quiet after it ends.",
            created_at: iso(t + mins(36)),
          }),
          (t) => ({
            sender_id: testerId,
            content: "that quiet after is loud sometimes.",
            created_at: iso(t + mins(51)),
          }),
          (t) => ({
            sender_id: ghostIds.VelvetSignal,
            content: "what’s a song that feels like your current life?",
            created_at: iso(t + mins(68)),
          }),
        ],
      },
      {
        ghost: "HollowBloom",
        createdAt: now - hours(10),
        intro: "two people moving fast, feeling it.",
        messages: [
          (t) => ({
            sender_id: ghostIds.HollowBloom,
            content: "sometimes i miss when conversations felt easier",
            created_at: iso(t + mins(7)),
          }),
          (t) => ({
            sender_id: testerId,
            content: "yeah. now it feels like there’s always a layer in the way.",
            created_at: iso(t + mins(19)),
          }),
          (t) => ({
            sender_id: ghostIds.HollowBloom,
            content: "exactly. like i’m optimizing my days and quietly losing the point.",
            created_at: iso(t + mins(33)),
          }),
          (t) => ({
            sender_id: ghostIds.HollowBloom,
            content: "what’s something you’ve been keeping to yourself lately?",
            created_at: iso(t + mins(48)),
          }),
        ],
      },
    ];

    for (const th of threads) {
      const convId = await getOrCreateConversation(
        testerId,
        ghostIds[th.ghost],
        th.intro,
        th.createdAt,
      );
      if (!(await conversationHasMessages(convId))) {
        const rows = th.messages.map((mk) => ({
          conversation_id: convId,
          ...mk(th.createdAt),
        }));
        await insertMessages(convId, rows);
      }
    }
  }

  // Keep them “alive” right now (matchmaking sorts by last_active)
  await supabase
    .from("profiles")
    .update({ last_active: iso(now - mins(2)) })
    .eq("id", ghostIds.VelvetSignal);

  console.log("Seeded ghost users:");
  for (const g of GHOSTS) {
    console.log(`- ${g.username} (${ghostIds[g.username]})`);
  }
  if (SEED_TARGET_USER_EMAIL) {
    console.log(
      testerId
        ? `Seeded inbox threads for: ${SEED_TARGET_USER_EMAIL}`
        : `Skipped inbox seeding (no user found for: ${SEED_TARGET_USER_EMAIL})`,
    );
  }
  console.log('Run with "--reset" to regenerate conversations/messages.');
}

await main();
