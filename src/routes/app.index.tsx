import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { AlertTriangle, Crosshair, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { AuthGate } from "@/components/app/AuthGate";
import { DetailsPanel } from "@/components/app/DetailsPanel";
import { ReportModal } from "@/components/app/ReportModal";
import type { MapPlace } from "@/components/app/MapCanvas";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { geocodeLocation, getNearbyPlaces } from "@/lib/places.functions";
import {
  PLACE_CATEGORIES,
  haversineKm,
  summarizeReports,
  type CrowdLevel,
  type PlaceCategory,
} from "@/lib/queue";

const MapCanvas = lazy(() => import("@/components/app/MapCanvas"));

const DEFAULT_CENTER: [number, number] = [51.5074, -0.1278];

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Live Queue Map — QueuePredict" },
      {
        name: "description",
        content:
          "Explore an interactive map of nearby banks, hospitals, offices and stores with live crowd levels and predicted wait times.",
      },
      { property: "og:title", content: "Live Queue Map — QueuePredict" },
      {
        property: "og:description",
        content: "Live crowd levels and AI wait-time predictions for places near you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://queue-predict-vision.lovable.app/app" }],
  }),
  component: MapPage,
});


type PlaceRow = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string;
};

function MapPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const nearby = useServerFn(getNearbyPlaces);
  const geocode = useServerFn(geocodeLocation);

  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [category, setCategory] = useState<PlaceCategory>("bank");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Your browser does not support location. Showing a default area.");
      setLocating(false);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: [number, number] = [position.coords.latitude, position.coords.longitude];
        setUserPosition(next);
        setCenter(next);
        setGeoError(null);
        setLocating(false);
      },
      (error) => {
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "Location access denied — search for an area instead."
            : "Could not determine your location. Showing a default area.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  const placesQuery = useQuery({
    queryKey: ["places", center[0].toFixed(3), center[1].toFixed(3), category],
    queryFn: async () =>
      nearby({ data: { lat: center[0], lng: center[1], category, radius: 4000 } }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const placeRows = (placesQuery.data?.places ?? []) as PlaceRow[];
  const placeIds = useMemo(() => placeRows.map((place) => place.id), [placeRows]);

  const reportsQuery = useQuery({
    queryKey: ["reports", placeIds],
    enabled: placeIds.length > 0,
    refetchInterval: 60000,
    queryFn: async () => {
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("crowd_reports")
        .select("place_id, crowd_level, estimated_wait_mins, created_at")
        .in("place_id", placeIds)
        .gte("created_at", since);
      if (error) throw error;
      return data ?? [];
    },
  });

  const savedQuery = useQuery({
    queryKey: ["saved", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_places").select("place_id");
      if (error) throw error;
      return (data ?? []).map((row) => row.place_id);
    },
  });

  const places: MapPlace[] = useMemo(() => {
    const grouped = new Map<
      string,
      { crowd_level: CrowdLevel; estimated_wait_mins: number; created_at: string }[]
    >();
    for (const report of reportsQuery.data ?? []) {
      const list = grouped.get(report.place_id) ?? [];
      list.push({
        crowd_level: report.crowd_level as CrowdLevel,
        estimated_wait_mins: report.estimated_wait_mins,
        created_at: report.created_at,
      });
      grouped.set(report.place_id, list);
    }
    const term = query.trim().toLowerCase();
    return placeRows
      .filter((place) => (term ? place.name.toLowerCase().includes(term) : true))
      .map((place) => ({
        ...place,
        summary: summarizeReports(place.id, grouped.get(place.id) ?? []),
      }));
  }, [placeRows, reportsQuery.data, query]);

  const selected = places.find((place) => place.id === selectedId) ?? null;
  const distanceKm =
    selected && userPosition
      ? haversineKm(
          { lat: userPosition[0], lng: userPosition[1] },
          { lat: selected.latitude, lng: selected.longitude },
        )
      : null;

  const savedIds = savedQuery.data ?? [];
  const isSaved = selected ? savedIds.includes(selected.id) : false;

  const saveMutation = useMutation({
    mutationFn: async (place: MapPlace) => {
      if (!user) throw new Error("auth");
      if (savedIds.includes(place.id)) {
        const { error } = await supabase
          .from("saved_places")
          .delete()
          .eq("place_id", place.id)
          .eq("user_id", user.id);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await supabase
        .from("saved_places")
        .insert({ place_id: place.id, user_id: user.id });
      if (error) throw error;
      return "added" as const;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["saved"] });
      toast.success(result === "added" ? "Place saved" : "Removed from saved");
    },
    onError: (error: Error) => {
      if (error.message === "auth") {
        setNeedsAuth(true);
        return;
      }
      toast.error("Could not update saved places.");
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (input: { level: CrowdLevel; wait: number }) => {
      if (!user || !selected) throw new Error("auth");
      const { error } = await supabase.from("crowd_reports").insert({
        place_id: selected.id,
        user_id: user.id,
        crowd_level: input.level,
        estimated_wait_mins: input.wait,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReportOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Thanks! Your report is live.");
    },
  });

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) return;
    if (places.length > 0) return; // name filter already matched visible places
    setSearching(true);
    try {
      const results = await geocode({ data: { query: term } });
      if (results.length === 0) {
        toast.error("No matching location found.");
        return;
      }
      const first = results[0]!;
      setCenter([first.lat, first.lng]);
      setQuery("");
      setSelectedId(null);
      toast.success(`Showing ${first.label.split(",")[0]}`);
    } catch {
      toast.error("Location search is unavailable right now.");
    } finally {
      setSearching(false);
    }
  }

  function openReport() {
    if (!user) {
      setNeedsAuth(true);
      return;
    }
    setReportOpen(true);
  }

  if (needsAuth) {
    return (
      <div className="min-h-screen">
        <AuthGate
          title="Sign in to continue"
          description="You need an account to report a queue or save a place."
        />
        <div className="pb-6 text-center">
          <button
            type="button"
            onClick={() => setNeedsAuth(false)}
            className="text-sm text-qp-muted underline"
          >
            Back to the map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <ClientOnly
        fallback={
          <div className="flex h-full items-center justify-center bg-qp-bg text-qp-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-qp-bg text-qp-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          }
        >
          <MapCanvas
            center={center}
            userPosition={userPosition}
            places={places}
            selectedId={selectedId}
            onSelect={(place) => setSelectedId(place.id)}
          />
        </Suspense>
      </ClientOnly>

      <h1 className="sr-only">Live queue map — nearby crowd levels and wait times</h1>

      {/* Floating search + filters */}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100] p-3 md:p-4">
        <div className="pointer-events-auto mx-auto w-full max-w-xl">
          <form onSubmit={handleSearch} className="qp-card flex items-center gap-2 rounded-full px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-qp-muted" />
            <input
              id="qp-place-search"
              aria-label="Search a place or an area"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a place or an area…"
              className="w-full bg-transparent text-sm text-qp-text outline-none placeholder:text-qp-muted"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <X className="h-4 w-4 text-qp-muted hover:text-qp-text" />
              </button>
            )}
            <button
              type="submit"
              disabled={searching}
              className="qp-gradient rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {searching ? "…" : "Go"}
            </button>
          </form>

          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {PLACE_CATEGORIES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setCategory(item.value);
                  setSelectedId(null);
                }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  category === item.value
                    ? "qp-gradient text-white"
                    : "qp-card text-qp-muted hover:text-qp-text"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {(geoError || placesQuery.isError || placesQuery.data?.degraded) && (
            <div className="qp-card mt-2 flex items-start gap-2 rounded-2xl px-4 py-2.5 text-xs text-qp-muted">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-qp-danger" />
              <span>
                {geoError ??
                  (placesQuery.isError
                    ? "We couldn't load nearby places. Try again in a moment."
                    : "Live place data is limited here — showing estimated locations.")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Status + recenter */}
      <div className="pointer-events-none absolute bottom-24 right-3 z-[1100] flex flex-col items-end gap-2 md:bottom-6 md:right-6">
        {(placesQuery.isFetching || locating) && (
          <span className="qp-card pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-qp-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {locating ? "Locating you…" : "Updating places…"}
          </span>
        )}
        <span className="qp-card pointer-events-auto rounded-full px-3 py-1.5 text-xs text-qp-muted">
          {places.length} places nearby
        </span>
        <button
          type="button"
          onClick={locate}
          aria-label="Recenter on my location"
          className="qp-gradient pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg"
        >
          <Crosshair className="h-5 w-5" />
        </button>
      </div>

      <DetailsPanel
        place={selected}
        distanceKm={distanceKm}
        saved={isSaved}
        savingBusy={saveMutation.isPending}
        onClose={() => setSelectedId(null)}
        onToggleSave={() => {
          if (!user) {
            setNeedsAuth(true);
            return;
          }
          if (selected) saveMutation.mutate(selected);
        }}
        onReport={openReport}
      />

      <ReportModal
        open={reportOpen}
        placeName={selected?.name ?? ""}
        submitting={reportMutation.isPending}
        error={reportMutation.isError ? "Could not save your report. Please try again." : null}
        onClose={() => setReportOpen(false)}
        onSubmit={(level, wait) => reportMutation.mutate({ level, wait })}
      />
    </div>
  );
}
