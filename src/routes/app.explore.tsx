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
    // Always start with a fresh chat experience, as requested.
    // Old AI chats are not loaded to ensure a "start over" behavior.
    setMessages([
      {
        id: "seed",
        role: "assistant",
        content: "Hey. No pressure to perform here. What's been sitting on your mind lately?",
        created_at: new Date().toISOString(),
      },
    ]);
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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex shrink-0 items-center gap-3 sm:mb-8">
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

      <div ref={scrollerRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain pr-0.5 pb-4 [-webkit-overflow-scrolling:touch] sm:pr-1 sm:pb-6">
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
                <p className="max-w-[min(92vw,28rem)] text-[16px] leading-relaxed text-foreground/90 sm:max-w-[85%] sm:text-[17px] font-display">
                  {m.content}
                </p>
              ) : (
                <div className="max-w-[min(92vw,28rem)] rounded-2xl bg-secondary/70 px-3.5 py-2.5 text-[15px] leading-relaxed text-secondary-foreground sm:max-w-[80%] sm:px-4 sm:py-2.5">
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
          className="mb-4 w-full max-w-xl self-center rounded-2xl p-4 glass sm:p-5"
        >
          <p className="mb-4 text-center text-sm text-foreground/90">
            Want to keep chatting with {COMPANION_NAME}, or connect with someone who feels resonant?
          </p>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
            <button
              type="button"
              onClick={() => setConnectionPromptOpen(false)}
              className="rounded-full px-4 py-3 text-sm glass transition-colors hover:bg-white/5 sm:py-2"
            >
              Keep chatting
            </button>
            <button
              type="button"
              onClick={findSomeone}
              disabled={searching}
              className="rounded-full bg-ember px-4 py-3 text-sm text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-60 sm:py-2"
            >
              {searching ? "Looking quietly…" : "Connect me"}
            </button>
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSend} className="relative shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="say what's unsaid…"
          className="min-h-[48px] w-full rounded-2xl glass py-3.5 pl-4 pr-14 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring sm:px-5 sm:py-4"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ember text-primary-foreground transition-transform hover:scale-105 disabled:opacity-30 sm:right-2 sm:h-10 sm:w-10"
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
            className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-xl sm:items-center sm:px-6 sm:pb-6 sm:pt-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative max-h-[min(92dvh,640px)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl p-6 text-center glass sm:max-h-[85dvh] sm:p-10"
            >
              <div className="absolute inset-0 -z-10 flex items-center justify-center">
                <div className="w-96 h-96 rounded-full bg-[var(--gradient-ember)] blur-3xl animate-breathe opacity-60" />
              </div>
              <div className="mb-5 flex justify-center sm:mb-6">
                <div className="origin-center scale-[0.82] sm:scale-100">
                  <Orb seed={match.avatar_seed} size={88} />
                </div>
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
