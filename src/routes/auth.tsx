import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Enter — Unsaid" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (session) navigate({ to: "/app" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (mode === "signup" && password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-stretch justify-center overflow-hidden px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-[80vmin] w-[80vmin] rounded-full bg-[var(--gradient-ember)] blur-3xl animate-breathe opacity-60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9 }}
        className="mx-auto w-full max-w-md"
      >
        <Link
          to="/"
          className="flex items-center gap-2 mb-12 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-ember" />
          <span className="font-display tracking-tight">Unsaid</span>
        </Link>

        <h1 className="font-display text-4xl md:text-5xl mb-3 leading-tight">
          {mode === "signup" ? (
            <>
              Step <em className="italic font-light text-ember">in.</em>
            </>
          ) : (
            <>
              Welcome <em className="italic font-light text-ember">back.</em>
            </>
          )}
        </h1>
        <p className="text-muted-foreground text-[15px] leading-relaxed mb-10">
          {mode === "signup"
            ? "No name. No photo. Just a quiet doorway in."
            : "Your conversations have been waiting for you."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl glass text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl glass py-3.5 pl-4 pr-12 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {mode === "signup" && (
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl glass py-3.5 pl-4 pr-12 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
          {err && <div className="text-xs text-destructive px-1">{err}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 px-5 py-3.5 rounded-2xl bg-ember text-primary-foreground font-medium text-sm shadow-[var(--shadow-ember)] hover:scale-[1.01] transition-transform disabled:opacity-60"
          >
            {loading ? "…" : mode === "signup" ? "Begin" : "Continue"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setErr("");
            setConfirmPassword("");
            setShowPassword(false);
            setShowConfirmPassword(false);
          }}
          className="block mx-auto mt-8 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "signup" ? "Already here? Sign in" : "New here? Step in"}
        </button>
      </motion.div>
    </div>
  );
}
