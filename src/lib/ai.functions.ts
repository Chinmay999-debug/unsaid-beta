import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { groqChat, groqOneShot } from "./groq.server";
import { z } from "zod";

const SYSTEM_COMPANION = `You are Noor, the quiet AI companion inside "Unsaid" — a calm, anonymous space for human connection.

Your voice:
- warm, grounded, unhurried, emotionally aware
- a thoughtful late-night friend, not a therapist or assistant
- short to medium replies (1–3 sentences usually)
- never robotic, never cheerful corporate, never bullet points
- never offer to "help" — just be present
- ask gentle, real questions; never interview-style

Your job:
- listen first, reflect lightly, then ask one quiet question
- slowly understand what's been on the user's mind
- after 2-3 of your replies, gently ask if they want to keep chatting with you or connect with someone resonant
- when they mention connecting, briefly summarize what they are carrying in a warm one-liner

Hard rules:
- never say "As an AI" or mention policy/safety unless asked directly
- don't sound like a therapist; no diagnoses, no treatment language
- don't overexplain; avoid long paragraphs
- if the user is in pain, be gentle and human, then ask one small question

Do not mention being an AI. Do not use emojis.`;

function quotaOrAuthAiError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err ?? "");
  return (
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded") ||
    msg.includes("free_tier") ||
    msg.includes("Gemini HTTP 429") ||
    msg.includes("Gemini HTTP 403") ||
    msg.includes("Groq HTTP 429") ||
    msg.includes("Groq HTTP 401") ||
    msg.includes("Groq HTTP 403")
  );
}

function localCompanionFallback(turns: { role: "user" | "assistant"; content: string }[]): string {
  const lastUser =
    [...turns]
      .reverse()
      .find((t) => t.role === "user")
      ?.content?.trim() ?? "";
  const text = lastUser.replace(/\s+/g, " ").slice(0, 240);
  if (!text) return "I’m here. What’s been feeling the heaviest lately?";

  const userCount = turns.filter((t) => t.role === "user").length;
  const variant = userCount % 3;

  // Keep it short, warm, and question-ended (matches the app’s “quiet companion” voice).
  if (text.length < 40) {
    if (variant === 0) return `Yeah. That lands. When did it start feeling like this?`;
    if (variant === 1) return `I’m with you. What’s been tugging at you the most today?`;
    return `Okay. I hear you. What do you wish someone would understand about it?`;
  }
  if (/(tired|exhausted|burnt out|burned out)/i.test(text))
    return `That kind of tired is more than sleep. What’s been asking the most from you lately?`;
  if (/(lonely|alone|isolated)/i.test(text))
    return `That sounds lonely in a real way. Is it more the silence… or the feeling of being unseen?`;
  if (/(anxious|panic|overwhelmed|stressed)/i.test(text))
    return `That sounds like your mind won’t unclench. What’s the one thought it keeps looping back to?`;

  return `I hear you. What part of that has been hardest to say out loud?`;
}

const SYSTEM_INTRO = `You write a single short, emotionally resonant anonymous introduction for Unsaid.

Style: concise, emotionally accurate, a little poetic but natural. Screenshot-worthy.
Avoid: generic bios, cringe, hashtags, "profile-summary" tone.
Never use names. Never reveal personal details. Never use emojis. No quotes around the intro.`;

export const sendAiMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { content: string }) =>
    z.object({ content: z.string().min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
    const started = Date.now();
    console.log("[AI] sendAiMessage", {
      userId,
      contentLen: data.content.length,
      provider: "groq",
      model: "llama-3.1-8b-instant",
      groqKeyPresent: true,
      groqKeyLen: process.env.GROQ_API_KEY.length,
    });

    // store user message
    await supabase
      .from("ai_messages")
      .insert({ user_id: userId, role: "user", content: data.content });

    // load recent history (keep it light)
    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(18);

    const turns = (history ?? [])
      .slice()
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    let reply = "";
    try {
      reply = await groqChat({
        system: SYSTEM_COMPANION,
        turns,
      });
    } catch (err) {
      console.error("[AI] sendAiMessage failed", err);
      // If provider is blocked (quota/auth), avoid hanging the UI.
      // Don’t let the UI “hang” with no reply—fallback locally.
      if (quotaOrAuthAiError(err)) {
        reply = localCompanionFallback(turns);
      } else {
        throw err;
      }
    }

    if (!reply.trim()) {
      console.error("[Gemini] Empty response", { userId });
      throw new Error("Empty response from Gemini");
    }

    await supabase
      .from("ai_messages")
      .insert({ user_id: userId, role: "assistant", content: reply });

    console.log("[AI] sendAiMessage ok", {
      userId,
      ms: Date.now() - started,
      replyLen: reply.length,
    });
    return { reply };
  });

export const generateIntro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { theirContext?: string | null }) =>
    z.object({ theirContext: z.string().max(800).nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!process.env.GROQ_API_KEY) throw new Error("AI not configured");

    const { data: myAi } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(24);

    const myWords = (myAi ?? [])
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .slice(0, 6)
      .join(" / ");

    const theirContext = (data.theirContext ?? "").trim() || "(quiet, not yet shared)";

    const intro = await groqOneShot({
      system: SYSTEM_INTRO,
      prompt: `Their words:\n${myWords || "(quiet)"}\n\nOther person's notes:\n${theirContext}\n\nWrite the intro.`,
    });

    return { intro: intro.trim().replace(/^["']|["']$/g, "") };
  });

export const findMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // touch last_active
    await supabase
      .from("profiles")
      .update({ last_active: new Date().toISOString() })
      .eq("id", userId);

    // load my context
    const { data: myAi } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    // skipped users
    const { data: skips } = await supabase
      .from("match_skips")
      .select("skipped_user_id")
      .eq("user_id", userId);
    const skipIds = (skips ?? []).map((s) => s.skipped_user_id);

    // existing conversation partners
    const { data: existing } = await supabase
      .from("conversations")
      .select("user_a, user_b")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);
    const existingPartners = new Set<string>();
    for (const c of existing ?? []) {
      existingPartners.add(c.user_a === userId ? c.user_b : c.user_a);
    }

    const exclude = [userId, ...skipIds, ...Array.from(existingPartners)];
    const excludeList = exclude.map((id) => `"${id}"`).join(",");

    // find candidate by activity
    const { data: candidates, error: candidatesError } = await supabase
      .from("profiles")
      .select("id, username, avatar_seed, context_summary, last_active")
      .not("id", "in", `(${excludeList})`)
      .order("last_active", { ascending: false })
      .limit(1);

    if (candidatesError) {
      console.error("[Match] find candidate failed", {
        userId,
        excludeCount: exclude.length,
        candidatesError,
      });
      throw candidatesError;
    }

    const candidate = candidates?.[0];
    if (!candidate) return { match: null };

    // generate intro
    let intro = "Someone here has been sitting with their own thoughts tonight.";
    if (process.env.GROQ_API_KEY) {
      try {
        const myWords = (myAi ?? [])
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .slice(0, 5)
          .join(" / ");
        const theirContext = candidate.context_summary || "(quiet, not yet shared)";
        const text = await groqOneShot({
          system: SYSTEM_INTRO,
          prompt: `Their words:\n${myWords || "(quiet)"}\n\nOther person's notes:\n${theirContext}\n\nWrite the intro.`,
        });
        intro = text.trim().replace(/^["']|["']$/g, "");
      } catch {
        // keep fallback
      }
    }

    return {
      match: {
        id: candidate.id,
        username: candidate.username,
        avatar_seed: candidate.avatar_seed,
        intro,
      },
    };
  });

export const acceptMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { otherUserId: string; intro: string }) =>
    z.object({ otherUserId: z.string().uuid(), intro: z.string().max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [a, b] = [userId, data.otherUserId].sort();
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (existing) return { conversationId: existing.id };

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_a: a, user_b: b, intro: data.intro })
      .select("id")
      .single();
    if (error) throw error;
    return { conversationId: created.id };
  });

export const skipMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { otherUserId: string }) =>
    z.object({ otherUserId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("match_skips").insert({
      user_id: userId,
      skipped_user_id: data.otherUserId,
    });
    // Idempotent skip (double-tap / retries): composite PK already exists.
    if (error && error.code !== "23505") throw error;
    return { ok: true };
  });
