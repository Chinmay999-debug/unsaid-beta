import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getAdminSnapshot, runGhostSeed } from "@/lib/admin.functions";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

type Snapshot = {
  counts: {
    users: number;
    activeLast5m: number;
    conversations: number;
    messages: number;
    aiMessages: number;
  };
  recentMessages: { id: string; created_at: string; content: string }[];
  recentAiMessages: { id: string; created_at: string; content: string }[];
  serverTime: string;
};

function AdminPage() {
  const { session } = useAuth();
  const getSnapshot = useServerFn(getAdminSnapshot);
  const seedFn = useServerFn(runGhostSeed);
  const [data, setData] = useState<Snapshot | null>(null);
  const [err, setErr] = useState("");
  const [seedMsg, setSeedMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const authHeaders = session?.access_token
    ? { authorization: `Bearer ${session.access_token}` }
    : undefined;

  async function load() {
    setErr("");
    try {
      const res = await getSnapshot({ headers: authHeaders });
      setData(res);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 10_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSeed() {
    setSeedMsg("");
    try {
      const res = await seedFn({ headers: authHeaders, data: { count: 5 } });
      setSeedMsg(res.message);
    } catch (e: unknown) {
      setSeedMsg(e instanceof Error ? e.message : "Seeding failed");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Admin Panel</h1>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-full glass text-sm hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading dashboard…</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Users" value={String(data.counts.users)} />
            <StatCard label="Active (5m)" value={String(data.counts.activeLast5m)} />
            <StatCard label="Conversations" value={String(data.counts.conversations)} />
            <StatCard label="Messages" value={String(data.counts.messages)} />
            <StatCard label="AI Messages" value={String(data.counts.aiMessages)} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <section className="glass rounded-2xl p-4">
              <h2 className="font-medium mb-3">Recent DMs</h2>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {data.recentMessages.map((m) => (
                  <div key={m.id} className="text-xs border-b border-border/30 pb-2">
                    <div className="text-muted-foreground">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div>{m.content}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass rounded-2xl p-4">
              <h2 className="font-medium mb-3">Recent AI Messages</h2>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {data.recentAiMessages.map((m) => (
                  <div key={m.id} className="text-xs border-b border-border/30 pb-2">
                    <div className="text-muted-foreground">
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div>{m.content}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="glass rounded-2xl p-4 space-y-3">
            <h2 className="font-medium">Seeder</h2>
            <p className="text-sm text-muted-foreground">
              Prepare 3-5 starter users before go-live so matching feels active.
            </p>
            <button
              type="button"
              onClick={onSeed}
              className="px-4 py-2 rounded-full bg-ember text-primary-foreground text-sm"
            >
              Show seed command
            </button>
            {!!seedMsg && <p className="text-sm">{seedMsg}</p>}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl">{value}</div>
    </div>
  );
}
