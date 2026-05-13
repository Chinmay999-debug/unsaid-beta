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
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-40 glass border-b border-border/40 pt-[max(0px,env(safe-area-inset-top))]">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center justify-between gap-3 min-w-0 sm:contents">
              <Link to="/app" className="flex items-center gap-2 min-w-0 shrink-0 sm:order-none">
                <span className="w-2 h-2 shrink-0 rounded-full bg-ember shadow-[0_0_18px_var(--ember)]" />
                <span className="font-display tracking-tight truncate">Unsaid</span>
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-2 shrink-0 sm:hidden"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex w-full min-w-0 items-stretch justify-between gap-0.5 rounded-full glass p-1 sm:flex-1 sm:justify-center sm:gap-1 sm:min-w-0">
              <Link
                to="/app"
                className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs sm:px-4 sm:py-1.5 sm:text-sm transition-colors ${
                  isInbox && !isExplore
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Inbox className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Inbox</span>
              </Link>
              <Link
                to="/app/explore"
                className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs sm:px-4 sm:py-1.5 sm:text-sm transition-colors ${
                  isExplore
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Explore</span>
              </Link>
              <Link
                to="/app/admin"
                className={`flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs sm:px-4 sm:py-1.5 sm:text-sm transition-colors ${
                  isAdmin
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Admin</span>
              </Link>
            </nav>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              className="hidden text-muted-foreground hover:text-foreground transition-colors p-2 sm:block shrink-0"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
