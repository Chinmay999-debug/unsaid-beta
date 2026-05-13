import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getAllowedAdminEmails(): Set<string> {
  const raw = (process.env.ADMIN_EMAILS || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
}

function requireAdmin(claims: Record<string, unknown>) {
  const allowed = getAllowedAdminEmails();
  if (!allowed.size) {
    throw new Error("Admin panel not configured. Set ADMIN_EMAILS in .env");
  }
  const email = String(claims.email ?? "").toLowerCase();
  if (!allowed.has(email)) {
    throw new Error("Unauthorized admin access");
  }
}

type AdminRecentItem = {
  id: string;
  created_at: string;
  content: string;
};

export const getAdminSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    requireAdmin(context.claims as Record<string, unknown>);

    const nowIso = new Date(Date.now() - 5 * 60_000).toISOString();

    const [profilesCount, convCount, msgCount, aiCount, activeNow, recentMessages, recentAi] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("conversations").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("messages").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("ai_messages").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("last_active", nowIso),
        supabaseAdmin
          .from("messages")
          .select("id, created_at, content")
          .order("created_at", { ascending: false })
          .limit(12),
        supabaseAdmin
          .from("ai_messages")
          .select("id, created_at, content")
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

    return {
      counts: {
        users: profilesCount.count ?? 0,
        activeLast5m: activeNow.count ?? 0,
        conversations: convCount.count ?? 0,
        messages: msgCount.count ?? 0,
        aiMessages: aiCount.count ?? 0,
      },
      recentMessages: ((recentMessages.data ?? []) as AdminRecentItem[]).map((r) => ({
        ...r,
        content: r.content.slice(0, 120),
      })),
      recentAiMessages: ((recentAi.data ?? []) as AdminRecentItem[]).map((r) => ({
        ...r,
        content: r.content.slice(0, 120),
      })),
      serverTime: new Date().toISOString(),
    };
  });

export const runGhostSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { count?: number }) =>
    z.object({ count: z.number().min(3).max(5).optional() }).parse(d),
  )
  .handler(async ({ context }) => {
    requireAdmin(context.claims as Record<string, unknown>);
    // This endpoint is intentionally lightweight; actual seeding runs via script.
    // Expose a clean message for admins inside the panel.
    return {
      ok: true,
      message:
        'Run "npm run seed:ghosts" in terminal (with SUPABASE_SERVICE_ROLE_KEY set) to seed 3-5 users.',
    };
  });
