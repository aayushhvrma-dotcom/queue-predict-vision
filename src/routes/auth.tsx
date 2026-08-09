import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const searchSchema = z.object({
  redirect: z.string().optional().default("/app"),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in — QueuePredict" },
      {
        name: "description",
        content:
          "Sign in or create a QueuePredict account to report live queues and save the places you visit most.",
      },
      { property: "og:title", content: "Sign in — QueuePredict" },
      {
        property: "og:description",
        content: "Create an account to report crowds and save places.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function safePath(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/app";
  return path;
}

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = safePath(search.redirect);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: target, replace: true });
    });
  }, [navigate, target]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name: name.trim() || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}${target}`,
          },
        });
        if (signUpError) throw signUpError;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          toast.success("Account created");
          void navigate({ to: target, replace: true });
        } else {
          toast.success("Check your email to confirm your account.");
          setMode("signin");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        toast.success("Welcome back");
        void navigate({ to: target, replace: true });
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Authentication failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      sessionStorage.setItem("qp:redirect", target);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("Google sign-in failed. Please try again.");
        return;
      }
      if (result.redirected) return;
      void navigate({ to: target, replace: true });
    } catch {
      setError("Google sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="qp-scope flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/app"
          className="mb-5 inline-flex items-center gap-2 text-sm text-qp-muted hover:text-qp-text"
        >
          <ArrowLeft className="h-4 w-4" /> Back to map
        </Link>

        <div className="qp-card rounded-3xl p-7">
          <span className="qp-gradient flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold text-white">
            QP
          </span>
          <h1 className="mt-5 text-2xl font-semibold text-qp-text">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-qp-muted">
            {mode === "signin"
              ? "Sign in to report queues and manage saved places."
              : "Join QueuePredict to share live queue data with your city."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Full name"
                autoComplete="name"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-qp-text outline-none placeholder:text-qp-muted focus:border-qp-primary-soft"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-qp-text outline-none placeholder:text-qp-muted focus:border-qp-primary-soft"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password (min. 6 characters)"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-qp-text outline-none placeholder:text-qp-muted focus:border-qp-primary-soft"
            />

            {error && (
              <p className="rounded-2xl border border-qp-danger/40 bg-qp-danger/10 px-4 py-2.5 text-sm text-qp-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="qp-gradient flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Log in" : "Sign up"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-qp-muted">
            <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-qp-text transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm text-qp-muted">
            {mode === "signin" ? "New to QueuePredict?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="font-medium text-qp-primary-soft hover:underline"
            >
              {mode === "signin" ? "Create one" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
