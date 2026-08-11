import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, LogOut, Mail, Flag } from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/app/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { levelMeta, type CrowdLevel } from "@/lib/queue";

export const Route = createFileRoute("/app/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — QueuePredict" },
      {
        name: "description",
        content:
          "Manage your QueuePredict display name and review the crowd reports you have submitted.",
      },
      { property: "og:title", content: "Your Profile — QueuePredict" },
      {
        property: "og:description",
        content: "Manage your account and review your queue reports on QueuePredict.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://queue-predict-vision.lovable.app/app/profile" }],
  }),
  component: ProfilePage,
});


function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const reportsQuery = useQuery({
    queryKey: ["my-reports", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crowd_reports")
        .select("id, crowd_level, estimated_wait_mins, created_at, places(name)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        crowd_level: string;
        estimated_wait_mins: number;
        created_at: string;
        places: { name: string } | null;
      }[];
    },
  });

  useEffect(() => {
    if (profileQuery.data?.name) setName(profileQuery.data.name);
  }, [profileQuery.data?.name]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user!.id, name: name.trim(), email: user!.email ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: () => toast.error("Could not update your profile."),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Could not sign out. Please try again.");
      return;
    }
    void navigate({ to: "/app", replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-qp-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate
        title="Your profile"
        description="Sign in to manage your account and see the reports you've submitted."
      />
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-qp-text">Profile</h1>

        <section className="qp-card mt-5 rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <span className="qp-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white">
              {(name || user.email || "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-qp-text">
                {name || "Unnamed explorer"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-qp-muted">
                <Mail className="h-3.5 w-3.5" />
                {user.email}
              </p>
            </div>
          </div>

          <label htmlFor="qp-display-name" className="mt-6 block text-[11px] uppercase tracking-wider text-qp-muted">
            Display name
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="qp-display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-qp-text outline-none focus:border-qp-primary-soft"
              placeholder="Your name"
            />
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || name.trim().length === 0}
              className="qp-gradient rounded-full px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </section>

        <section className="qp-card mt-4 rounded-3xl p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-qp-text">
            <Flag className="h-4 w-4 text-qp-primary-soft" /> Your recent reports
          </h2>
          {reportsQuery.isLoading && (
            <p className="mt-3 text-sm text-qp-muted">Loading reports…</p>
          )}
          {!reportsQuery.isLoading && (reportsQuery.data?.length ?? 0) === 0 && (
            <p className="mt-3 text-sm text-qp-muted">
              You haven't reported a queue yet. Open a place on the map to add one.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {(reportsQuery.data ?? []).map((report) => {
              const meta = levelMeta(report.crowd_level as CrowdLevel);
              return (
                <li
                  key={report.id}
                  className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-qp-text">
                      {report.places?.name ?? "Unknown place"}
                    </p>
                    <p className="text-xs text-qp-muted">
                      {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm font-medium" style={{ color: meta.color }}>
                    {meta.label} · {report.estimated_wait_mins}m
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-qp-danger/40 bg-qp-danger/10 px-5 py-3 text-sm font-semibold text-qp-danger transition-colors hover:bg-qp-danger/20"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </div>
  );
}
