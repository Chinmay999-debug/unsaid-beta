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
    <div
      className="max-w-3xl mx-auto px-6 py-6 flex flex-col"
      style={{ minHeight: "calc(100vh - 64px)" }}
    >
      <div className="flex items-center gap-3 pb-5 border-b border-border/40">
        <Link to="/app" className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        {other && (
          <>
            <div className="relative">
              <Orb seed={other.avatar_seed} size={40} />
              {online && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-ember ring-2 ring-background" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg leading-tight">{other.username}</div>
              <div className="text-[11px] text-muted-foreground">
                {online ? "here, now" : "away"}
              </div>
            </div>
          </>
        )}
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto py-6 space-y-3">
        {intro && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-10"
          >
            <div className="text-xs tracking-[0.3em] text-muted-foreground mb-3">COMPANION</div>
            <p className="font-display italic text-lg text-foreground/80 max-w-md mx-auto leading-snug">
              &ldquo;{intro}&rdquo;
            </p>
            <div className="text-xs text-muted-foreground/60 mt-4">say the first thing</div>
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
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed ${
                    mine
                      ? "bg-ember text-primary-foreground rounded-br-md"
                      : "glass text-foreground rounded-bl-md"
                  }`}
                >
                  {m.content}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <form onSubmit={send} className="relative pb-2">
        <input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="write something honest…"
          className="w-full px-5 py-4 pr-14 rounded-2xl glass text-[15px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="absolute right-2 top-1/2 -translate-y-1/2 -mt-1 w-10 h-10 rounded-full bg-ember text-primary-foreground flex items-center justify-center disabled:opacity-30 hover:scale-105 transition-transform"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
