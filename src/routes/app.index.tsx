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
    <div className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl mb-2">Inbox</h1>
        <p className="text-muted-foreground text-sm mb-6 sm:mb-10">
          Conversations stay here, quietly waiting.
        </p>
      </motion.div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading…</div>
      ) : convs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
                  className="group flex min-w-0 items-start gap-3 rounded-2xl p-3.5 glass transition-colors hover:bg-white/5 sm:items-center sm:gap-4 sm:p-4 active:bg-white/[0.07]"
                >
                  <div className="relative shrink-0 pt-0.5 sm:pt-0">
                    <Orb seed={c.other?.avatar_seed ?? c.id} size={48} />
                    {online && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-ember ring-2 ring-background" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex min-w-0 flex-col gap-0.5 min-[380px]:flex-row min-[380px]:items-baseline min-[380px]:justify-between min-[380px]:gap-3">
                      <span className="min-w-0 truncate font-display text-base sm:text-lg">
                        {c.other?.username ?? "Someone"}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground/60 tabular-nums min-[380px]:text-right">
                        {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false })}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground sm:truncate sm:mt-0.5">
                      {c.preview}
                    </p>
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
      className="relative overflow-hidden rounded-3xl px-4 py-16 text-center glass sm:py-24"
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
