import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { sendAiMessage, findMatch, acceptMatch, skipMatch } from "@/lib/ai.functions";
import { Orb } from "@/components/Orb";
import { Send, X, Heart } from "lucide-react";

export const Route = createFileRoute("/app/explore")({
  component: ExplorePage,
});

type AiMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};
type Match = { id: string; username: string; avatar_seed: string; intro: string };
const COMPANION_NAME = "Noor AI";
const BOT_MATCH_ID = "bot:noor-ai";

function ExplorePage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [searching, setSearching] = useState(false);
  const [connectionPromptOpen, setConnectionPromptOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const send = useServerFn(sendAiMessage);
  const findFn = useServerFn(findMatch);
  const acceptFn = useServerFn(acceptMatch);
  const skipFn = useServerFn(skipMatch);

  const authHeaders = session?.access_token
    ? { authorization: `Bearer ${session.access_token}` }
    : undefined;

  function appendAssistantWithPacing(fullText: unknown) {
    const id = "a-" + Date.now();
    const created_at = new Date().toISOString();
    setMessages((m) => [...m, { id, role: "assistant", content: "", created_at }]);

    const text = typeof fullText === "string" ? fullText.trim() : String(fullText ?? "").trim();
    if (!text) {
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, content: "…" } : msg)));
      return;
    }
    const chunk = 6;
    let i = 0;
    const timer = window.setInterval(() => {
      i = Math.min(text.length, i + chunk);
      setMessages((m) =>
        m.map((msg) => (msg.id === id ? { ...msg, content: text.slice(0, i) } : msg)),
      );
      if (i >= text.length) window.clearInterval(timer);
    }, 28);
  }

  useEffect(() => {
    if (!user) return;
    supabase
      .from("ai_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const msgs = (data ?? []) as AiMsg[];
        if (msgs.length === 0) {
          // seed an opening line locally
          setMessages([
            {
              id: "seed",
              role: "assistant",
              content: "Hey. No pressure to perform here. What's been sitting on your mind lately?",
              created_at: new Date().toISOString(),
            },
          ]);
        } else {
          setMessages(msgs);
        }
      });
  }, [user]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    const assistantCount = messages.filter((m) => m.role === "assistant").length;
    if (!match && assistantCount >= 2) {
      setConnectionPromptOpen(true);
    }
  }, [messages, match]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || thinking) return;
    setInput("");
    setMessages((m) => [
      ...m.filter((x) => x.id !== "seed"),
      { id: "tmp-" + Date.now(), role: "user", content, created_at: new Date().toISOString() },
    ]);
    setThinking(true);
    try {
      const { reply } = await send({ data: { content }, headers: authHeaders });
      appendAssistantWithPacing(reply);
    } catch (err: unknown) {
      let msg = "";
      if (err instanceof Error) msg = err.message.trim();
      else if (typeof err === "string") msg = err.trim();
      appendAssistantWithPacing(
        msg ? `Something’s off — ${msg}` : "Something stirred — try again in a moment.",
      );
    } finally {
      setThinking(false);
    }
  }

  async function findSomeone(opts?: { allowBotFallback?: boolean }) {
    const allowBotFallback = opts?.allowBotFallback ?? true;
    setSearching(true);
    try {
      const { match } = await findFn({ headers: authHeaders });
      if (!match) {
        if (allowBotFallback) {
          setMatch({
            id: BOT_MATCH_ID,
            username: COMPANION_NAME,
            avatar_seed: BOT_MATCH_ID,
            intro:
              "I'm here right now. We can keep this gentle and real while we wait for more people to arrive.",
          });
        } else {
          appendAssistantWithPacing(
            "I checked again, and no new resonant person is available yet. Give it a little time and tap connect once more.",
          );
        }
        return;
      }
      setMatch(match);
      setConnectionPromptOpen(false);
    } finally {
      setSearching(false);
    }
  }

  async function accept() {
    if (!match) return;
    if (match.id === BOT_MATCH_ID) {
      setMatch(null);
      setConnectionPromptOpen(false);
      appendAssistantWithPacing(
        "I’m with you. We can stay here together for now, and when you want I can try connecting you with someone resonant again.",
      );
      return;
    }
    const { conversationId } = await acceptFn({
      data: { otherUserId: match.id, intro: match.intro },
      headers: authHeaders,
    });
    setMatch(null);
    navigate({ to: "/app/c/$convId", params: { convId: conversationId } });
  }

  async function skip() {
    if (!match) return;
    if (match.id === BOT_MATCH_ID) {
      setMatch(null);
      await findSomeone({ allowBotFallback: false });
      return;
    }
    await skipFn({ data: { otherUserId: match.id }, headers: authHeaders });
    setMatch(null);
    findSomeone();
  }

  const userMessageCount = messages.filter((m) => m.role === "user").length;

  return (
    <div
      className="max-w-3xl mx-auto px-6 py-10 flex flex-col"
      style={{ minHeight: "calc(100vh - 64px)" }}
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="relative">
          <span className="block w-9 h-9 rounded-full bg-gradient-to-br from-ember to-accent shadow-[0_0_30px_var(--ember-deep)] animate-breathe" />
        </div>
        <div>
          <div className="font-display text-lg leading-tight">{COMPANION_NAME}</div>
          <div className="text-xs text-muted-foreground">
            always listening, never recording faces
          </div>
        </div>
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto space-y-5 pr-1 pb-6">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" ? (
                <p className="max-w-[85%] text-[17px] leading-relaxed text-foreground/90 font-display">
                  {m.content}
                </p>
              ) : (
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl bg-secondary/70 text-secondary-foreground text-[15px] leading-relaxed">
                  {m.content}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-1.5 pl-1"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-ember/60 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-ember/60 animate-pulse [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-ember/60 animate-pulse [animation-delay:0.4s]" />
          </motion.div>
        )}
      </div>

      {userMessageCount >= 2 && !match && connectionPromptOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="self-center mb-4 w-full max-w-xl p-4 rounded-2xl glass"
        >
          <p className="text-sm text-foreground/90 text-center mb-3">
            Want to keep chatting with {COMPANION_NAME}, or connect with someone who feels resonant?
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setConnectionPromptOpen(false)}
              className="px-4 py-2 rounded-full glass text-sm hover:bg-white/5 transition-colors"
            >
              Keep chatting
            </button>
            <button
              type="button"
              onClick={findSomeone}
              disabled={searching}
              className="px-4 py-2 rounded-full bg-ember text-primary-foreground text-sm hover:scale-[1.02] transition-transform disabled:opacity-60"
            >
              {searching ? "Looking quietly…" : "Connect me"}
            </button>
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSend} className="relative">
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="say what's unsaid…"
          className="w-full px-5 py-4 pr-14 rounded-2xl glass text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-ember text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:scale-105 transition-transform"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <AnimatePresence>
        {match && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-background/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative max-w-md w-full p-10 rounded-3xl glass text-center overflow-hidden"
            >
              <div className="absolute inset-0 -z-10 flex items-center justify-center">
                <div className="w-96 h-96 rounded-full bg-[var(--gradient-ember)] blur-3xl animate-breathe opacity-60" />
              </div>
              <div className="flex justify-center mb-6">
                <Orb seed={match.avatar_seed} size={88} />
              </div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">
                {match.id === BOT_MATCH_ID ? "companion" : "someone"}
              </div>
              <div className="font-display text-2xl mb-6">{match.username}</div>
              <p className="font-display text-lg italic text-foreground/85 leading-snug mb-10">
                &ldquo;{match.intro}&rdquo;
              </p>
              <p className="text-xs text-muted-foreground mb-8">
                We will show this intro when you say hello. They can accept the vibe or pass.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={skip}
                  className="w-14 h-14 rounded-full glass flex items-center justify-center hover:bg-white/5 transition-colors"
                  aria-label="Skip"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
                <button
                  onClick={accept}
                  className="px-8 h-14 rounded-full bg-ember text-primary-foreground font-medium text-sm shadow-[var(--shadow-ember)] hover:scale-[1.02] transition-transform flex items-center gap-2"
                >
                  <Heart className="w-4 h-4" />{" "}
                  {match.id === BOT_MATCH_ID ? "Keep talking" : "Say hello"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
