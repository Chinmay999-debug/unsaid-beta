import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Orb } from "@/components/Orb";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/app/")({
  component: InboxPage,
});

type ConvRow = {
  id: string;
  user_a: string;
  user_b: string;
  intro: string | null;
  last_message_at: string;
  other?: { id: string; username: string; avatar_seed: string; last_active: string };
  preview?: string;
};

function InboxPage() {
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function load() {
      const { data: rows } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (!rows || !active) {
        setLoading(false);
        return;
      }
      const otherIds = rows.map((r) => (r.user_a === user!.id ? r.user_b : r.user_a));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_seed, last_active")
        .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);

      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at")
        .in(
          "conversation_id",
          rows.map((r) => r.id),
        )
        .order("created_at", { ascending: false });

      const previewMap = new Map<string, string>();
      for (const m of lastMsgs ?? []) {
        if (!previewMap.has(m.conversation_id)) previewMap.set(m.conversation_id, m.content);
      }

      const enriched = rows.map((r) => {
        const otherId = r.user_a === user!.id ? r.user_b : r.user_a;
        return {
          ...r,
          other: profiles?.find((p) => p.id === otherId),
          preview: previewMap.get(r.id) ?? r.intro ?? "",
        };
      });
      setConvs(enriched);
      setLoading(false);
    }
    load();

    const ch = supabase
      .channel("inbox-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl md:text-5xl mb-2">Inbox</h1>
        <p className="text-muted-foreground text-sm mb-10">
          Conversations stay here, quietly waiting.
        </p>
      </motion.div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : convs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {convs.map((c, i) => {
            const online =
              c.other && Date.now() - new Date(c.other.last_active).getTime() < 2 * 60_000;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  to="/app/c/$convId"
                  params={{ convId: c.id }}
                  className="group flex items-center gap-4 p-4 rounded-2xl glass hover:bg-white/5 transition-colors"
                >
                  <div className="relative">
                    <Orb seed={c.other?.avatar_seed ?? c.id} size={48} />
                    {online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-ember ring-2 ring-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-lg truncate">
                        {c.other?.username ?? "Someone"}
                      </span>
                      <span className="text-[11px] text-muted-foreground/60 shrink-0">
                        {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{c.preview}</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="relative text-center py-24 rounded-3xl glass overflow-hidden"
    >
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="w-72 h-72 rounded-full bg-[var(--gradient-ember)] blur-3xl animate-breathe opacity-50" />
      </div>
      <p className="font-display text-2xl mb-3">No conversations yet.</p>
      <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-8">
        Step into Explore. Talk with the companion. Let it find someone resonant.
      </p>
      <Link
        to="/app/explore"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ember text-primary-foreground text-sm font-medium shadow-[var(--shadow-ember)] hover:scale-[1.02] transition-transform"
      >
        Begin exploring →
      </Link>
    </motion.div>
  );
}
