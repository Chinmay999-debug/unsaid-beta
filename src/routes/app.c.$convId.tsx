import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Orb } from "@/components/Orb";
import { ArrowLeft, Send } from "lucide-react";

export const Route = createFileRoute("/app/c/$convId")({
  component: ChatPage,
});

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type Other = { id: string; username: string; avatar_seed: string; last_active: string };

function ChatPage() {
  const { convId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<Other | null>(null);
  const [intro, setIntro] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function load() {
      const { data: conv, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", convId)
        .single();
      if (error || !conv || !active) {
        if (active) navigate({ to: "/app" });
        return;
      }
      setIntro(conv.intro ?? "");
      const otherId = conv.user_a === user!.id ? conv.user_b : conv.user_a;
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, username, avatar_seed, last_active")
        .eq("id", otherId)
        .single();
      if (active) setOther(prof);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (active) setMessages(msgs ?? []);
    }
    load();

    const ch = supabase
      .channel("conv-" + convId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          setMessages((m) => {
            const newMsg = payload.new as Message;
            if (m.some((x) => x.id === newMsg.id)) return m;
            return [...m, newMsg];
          });
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [convId, user, navigate]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending || !user) return;
    setInput("");
    setSending(true);
    const tempId = "tmp-" + Date.now();
    setMessages((m) => [
      ...m,
      {
        id: tempId,
        conversation_id: convId,
        sender_id: user.id,
        content,
        created_at: new Date().toISOString(),
      },
    ]);
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, sender_id: user.id, content });
    if (error) {
      setMessages((m) => m.filter((x) => x.id !== tempId));
    } else {
      // The realtime INSERT subscription will deliver the canonical row (with real ID).
      // Remove the optimistic temp row to avoid duplicates like "hello hello".
      setMessages((m) => m.filter((x) => x.id !== tempId));
    }
    setSending(false);
  }

  const online = other && Date.now() - new Date(other.last_active).getTime() < 2 * 60_000;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 pb-4 sm:gap-3 sm:pb-5">
        <Link
          to="/app"
          className="flex shrink-0 items-center justify-center rounded-full p-2.5 transition-colors hover:bg-white/5 min-h-[44px] min-w-[44px] sm:-ml-2"
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        {other && (
          <>
            <div className="relative shrink-0">
              <Orb seed={other.avatar_seed} size={40} />
              {online && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-ember ring-2 ring-background" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-base leading-tight sm:text-lg">{other.username}</div>
              <div className="text-[11px] text-muted-foreground">{online ? "here, now" : "away"}</div>
            </div>
          </>
        )}
      </div>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain py-4 sm:py-6 [-webkit-overflow-scrolling:touch]"
      >
        {intro && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-1 py-6 text-center sm:py-10"
          >
            <div className="mb-3 text-xs tracking-[0.3em] text-muted-foreground">COMPANION</div>
            <p className="mx-auto max-w-md px-2 font-display text-base italic leading-snug text-foreground/80 sm:text-lg">
              &ldquo;{intro}&rdquo;
            </p>
            <div className="mt-4 text-xs text-muted-foreground/60">say the first thing</div>
          </motion.div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25 }}
                className={`flex ${mine ? "justify-end" : "justify-start"} px-0.5`}
              >
                <div
                  className={`max-w-[min(92vw,28rem)] px-3.5 py-2.5 text-[15px] leading-relaxed sm:max-w-[78%] sm:px-4 sm:py-2.5 ${
                    mine
                      ? "rounded-2xl rounded-br-md bg-ember text-primary-foreground"
                      : "glass rounded-2xl rounded-bl-md text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <form
        onSubmit={send}
        className="relative shrink-0 border-t border-transparent pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="write something honest…"
          className="min-h-[48px] w-full rounded-2xl glass py-3.5 pl-4 pr-14 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring sm:px-5 sm:py-4"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ember text-primary-foreground transition-transform hover:scale-105 disabled:opacity-30 sm:right-2 sm:h-10 sm:w-10"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
