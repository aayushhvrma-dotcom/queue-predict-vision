import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const nearbySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: z.enum(["bank", "hospital", "pharmacy", "post_office", "government"]),
  radius: z.number().min(500).max(20000).default(3000),
});

/** Each category can match several OSM tag combinations so nothing nearby is skipped. */
const OVERPASS_FILTERS: Record<string, string[]> = {
  bank: ['["amenity"="bank"]', '["office"="financial"]', '["shop"="bank"]'],
  hospital: [
    '["amenity"~"^(hospital|clinic|doctors)$"]',
    '["healthcare"~"^(hospital|clinic|doctor|centre)$"]',
    '["building"="hospital"]',
  ],
  pharmacy: [
    '["amenity"="pharmacy"]',
    '["healthcare"="pharmacy"]',
    '["shop"~"^(chemist|medical_supply)$"]',
  ],
  post_office: ['["amenity"="post_office"]', '["office"="post_office"]'],
  government: ['["office"="government"]', '["amenity"="townhall"]'],
};

const CATEGORY_RADIUS: Record<string, number> = {
  bank: 2500,
  hospital: 3000,
  pharmacy: 2500,
  post_office: 3000,
  government: 2500,
};

const CATEGORY_LABEL: Record<string, string> = {
  bank: "Bank",
  hospital: "Clinic",
  pharmacy: "Pharmacy",
  post_office: "Post Office",
  government: "Government Office",
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type PlaceRow = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  source_id: string;
};

function buildAddress(tags: Record<string, string>, lat: number, lng: number): string {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:suburb"],
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"],
    tags["addr:postcode"],
  ].filter((part) => part && part.length > 0);

  if (parts.length > 0) return parts.join(", ");
  return `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function metersBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Deterministic offline fallback so the map is never empty. */
function fallbackPlaces(lat: number, lng: number, category: string): PlaceRow[] {
  const label = CATEGORY_LABEL[category] ?? "Place";
  const names = ["Central", "Riverside", "Market Street", "North Gate", "Old Town", "Park Lane"];
  return names.map((name, index) => {
    const angle = (index / names.length) * Math.PI * 2;
    const dist = 0.006 + (index % 3) * 0.004;
    const plat = lat + Math.sin(angle) * dist;
    const plng = lng + Math.cos(angle) * dist * 1.4;
    return {
      name: `${name} ${label}`,
      address: `${name}, near ${lat.toFixed(3)}, ${lng.toFixed(3)}`,
      latitude: plat,
      longitude: plng,
      category,
      source_id: `demo:${category}:${lat.toFixed(2)}:${lng.toFixed(2)}:${index}`,
    };
  });
}

async function queryOverpass(
  lat: number,
  lng: number,
  category: string,
  radius: number,
): Promise<PlaceRow[]> {
  const filters = OVERPASS_FILTERS[category] ?? OVERPASS_FILTERS["bank"]!;
  const clauses = filters
    .map(
      (filter) =>
        `node${filter}(around:${radius},${lat},${lng});way${filter}(around:${radius},${lat},${lng});relation${filter}(around:${radius},${lat},${lng});`,
    )
    .join("");
  const query = `[out:json][timeout:25];(${clauses});out center 120;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept-Encoding": "gzip, deflate",
        "User-Agent": "QueuePredict/1.0 (queue prediction app)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass responded ${response.status}`);
    const json = (await response.json()) as { elements?: OverpassElement[] };

    return (json.elements ?? [])
      .map((element) => {
        const plat = element.lat ?? element.center?.lat;
        const plng = element.lon ?? element.center?.lon;
        const tags = element.tags ?? {};
        if (plat == null || plng == null) return null;
        const name = tags["name"] ?? tags["operator"] ?? CATEGORY_LABEL[category] ?? "Place";
        return {
          name,
          address: buildAddress(tags, plat, plng),
          latitude: plat,
          longitude: plng,
          category,
          source_id: `osm:${element.type}/${element.id}`,
        } satisfies PlaceRow;
      })
      .filter((row): row is PlaceRow => row !== null)
      // keep only what is truly inside the requested radius, closest first
      .map((row) => ({ row, d: metersBetween(lat, lng, row.latitude, row.longitude) }))
      .filter((item) => item.d <= radius * 1.05)
      .sort((a, b) => a.d - b.d)
      .map((item) => item.row)
      .filter((row, index, all) => all.findIndex((r) => r.source_id === row.source_id) === index)
      .slice(0, 60);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Finds real nearby places from OpenStreetMap, stores them in the database and
 * returns the stored rows (so reports can reference stable ids).
 */
export const getNearbyPlaces = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => nearbySchema.parse(input))
  .handler(async ({ data }) => {
    const baseRadius = CATEGORY_RADIUS[data.category] ?? data.radius;
    // Always widen in the background until we find a usable set of places, so
    // sparse areas still end up with a populated map.
    const ladder = [baseRadius, 5000, 8000, 12000, 20000].filter(
      (radius, index, all) => all.indexOf(radius) === index,
    );
    const ENOUGH_RESULTS = 8;

    let rows: PlaceRow[] = [];
    let degraded = false;

    for (const radius of ladder) {
      try {
        const attempt = await queryOverpass(data.lat, data.lng, data.category, radius);
        if (attempt.length > rows.length) rows = attempt;
        degraded = false;
      } catch {
        degraded = true;
      }
      if (rows.length >= ENOUGH_RESULTS) break;
    }

    if (rows.length === 0) {
      degraded = true;
      rows = fallbackPlaces(data.lat, data.lng, data.category);
    }



    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: upsertError } = await supabaseAdmin
      .from("places")
      .upsert(rows, { onConflict: "source_id", ignoreDuplicates: false });

    if (upsertError) {
      throw new Error(`Could not save nearby places: ${upsertError.message}`);
    }

    const { data: places, error } = await supabaseAdmin
      .from("places")
      .select("id, name, address, latitude, longitude, category, source_id")
      .in(
        "source_id",
        rows.map((row) => row.source_id),
      );

    if (error) throw new Error(`Could not load nearby places: ${error.message}`);

    return { places: places ?? [], degraded };
  });

const geocodeSchema = z.object({ query: z.string().min(2).max(120) });

/** Free-text location search (city, street, landmark) via OpenStreetMap. */
export const geocodeLocation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => geocodeSchema.parse(input))
  .handler(async ({ data }) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(data.query)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "QueuePredict/1.0 (queue prediction app)" },
    });
    if (!response.ok) throw new Error("Location search is unavailable right now.");
    const json = (await response.json()) as {
      display_name: string;
      lat: string;
      lon: string;
    }[];
    return json.map((item) => ({
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));
  });
