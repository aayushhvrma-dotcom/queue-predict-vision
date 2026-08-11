import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Loader2, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/app/AuthGate";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { levelMeta, summarizeReports, type CrowdLevel } from "@/lib/queue";

export const Route = createFileRoute("/app/saved")({
  head: () => ({
    meta: [
      { title: "Saved Places — QueuePredict" },
      {
        name: "description",
        content:
          "Your bookmarked places with their latest crowd levels and predicted waiting times in one list.",
      },
      { property: "og:title", content: "Saved Places — QueuePredict" },
      {
        property: "og:description",
        content: "Track crowd levels and wait times for the places you visit most.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://queue-predict-vision.lovable.app/app/saved" }],
  }),
  component: SavedPage,
});


type SavedRow = {
  id: string;
  place_id: string;
  places: {
    id: string;
    name: string;
    address: string | null;
    category: string;
  } | null;
};

function SavedPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const savedQuery = useQuery({
    queryKey: ["saved-detail", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_places")
        .select("id, place_id, places(id, name, address, category)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as SavedRow[];

      const ids = rows.map((row) => row.place_id);
      let reports: { place_id: string; crowd_level: string; estimated_wait_mins: number; created_at: string }[] =
        [];
      if (ids.length > 0) {
        const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
        const { data: reportData, error: reportError } = await supabase
          .from("crowd_reports")
          .select("place_id, crowd_level, estimated_wait_mins, created_at")
          .in("place_id", ids)
          .gte("created_at", since);
        if (reportError) throw reportError;
        reports = reportData ?? [];
      }
      return { rows, reports };
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_places").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["saved-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["saved"] });
      toast.success("Removed from saved");
    },
    onError: () => toast.error("Could not remove this place."),
  });

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
        title="Saved places"
        description="Sign in to keep a list of the places you check most often."
      />
    );
  }

  const rows = savedQuery.data?.rows ?? [];
  const reports = savedQuery.data?.reports ?? [];

  return (
    <div className="min-h-screen px-4 py-8 md:px-10">
      <header className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-qp-text">Saved places</h1>
        <p className="mt-1 text-sm text-qp-muted">
          Live crowd status for everything you bookmarked.
        </p>
      </header>

      <div className="mx-auto mt-6 max-w-3xl space-y-3">
        {savedQuery.isLoading && (
          <div className="qp-card flex items-center gap-2 rounded-3xl p-5 text-sm text-qp-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your places…
          </div>
        )}

        {savedQuery.isError && (
          <div className="qp-card rounded-3xl p-5 text-sm text-qp-danger">
            Could not load your saved places. Please refresh.
          </div>
        )}

        {!savedQuery.isLoading && rows.length === 0 && (
          <div className="qp-card rounded-3xl p-8 text-center">
            <Bookmark className="mx-auto h-6 w-6 text-qp-muted" />
            <p className="mt-3 text-sm text-qp-muted">
              Nothing saved yet. Open a place on the map and tap Save.
            </p>
            <Link
              to="/app"
              className="qp-gradient mt-5 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            >
              Go to the map
            </Link>
          </div>
        )}

        {rows.map((row) => {
          const place = row.places;
          if (!place) return null;
          const summary = summarizeReports(
            place.id,
            reports
              .filter((report) => report.place_id === place.id)
              .map((report) => ({
                crowd_level: report.crowd_level as CrowdLevel,
                estimated_wait_mins: report.estimated_wait_mins,
                created_at: report.created_at,
              })),
          );
          const meta = levelMeta(summary.level);

          return (
            <article key={row.id} className="qp-card flex items-center gap-4 rounded-3xl p-5">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-qp-text">{place.name}</h2>
                <p className="mt-1 flex items-start gap-1.5 truncate text-sm text-qp-muted">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {place.address ?? "Address unavailable"}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium" style={{ color: meta.color }}>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    {meta.label}
                  </span>
                  <span className="text-sm text-qp-muted">~{summary.wait} min wait</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeMutation.mutate(row.id)}
                disabled={removeMutation.isPending}
                aria-label={`Remove ${place.name}`}
                className="rounded-full bg-white/5 p-2.5 text-qp-muted transition-colors hover:bg-qp-danger/20 hover:text-qp-danger disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
