import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, Sparkles, Shield, LogOut } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppShell,
});

function AppShell() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // touch presence
  useEffect(() => {
    if (!user) return;
    const tick = () =>
      supabase.from("profiles").update({ last_active: new Date().toISOString() }).eq("id", user.id);
    tick();
    const i = setInterval(tick, 60_000);
    return () => clearInterval(i);
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-ember animate-pulse" />
      </div>
    );
  }

  const isExplore = loc.pathname.startsWith("/app/explore");
  const isAdmin = loc.pathname.startsWith("/app/admin");
  const isInbox =
    loc.pathname === "/app" ||
    loc.pathname.startsWith("/app/inbox") ||
    loc.pathname.startsWith("/app/c/");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass border-b border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ember shadow-[0_0_18px_var(--ember)]" />
            <span className="font-display tracking-tight">Unsaid</span>
          </Link>
          <nav className="flex items-center gap-1 p-1 rounded-full glass">
            <Link
              to="/app"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm transition-colors ${
                isInbox && !isExplore
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Inbox className="w-3.5 h-3.5" /> Inbox
            </Link>
            <Link
              to="/app/explore"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm transition-colors ${
                isExplore
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Explore
            </Link>
            <Link
              to="/app/admin"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm transition-colors ${
                isAdmin
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Admin
            </Link>
          </nav>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            className="text-muted-foreground hover:text-foreground transition-colors p-2"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
