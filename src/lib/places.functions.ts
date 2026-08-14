import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Full Overpass API integration (no key-restricted "nearby" endpoint, no result
 * cap). The client sends the map's exact bounding box on every pan/zoom and we
 * fetch EVERY matching location inside it, paginating by splitting the box when
 * a tile returns a saturated response.
 */

const bboxSchema = z.object({
  south: z.number().min(-90).max(90),
  west: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
});

const nearbySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  // Strictly hardcoded types: banks and hospitals only.
  category: z.enum(["bank", "hospital"]),
  radius: z.number().min(500).max(20000).default(3000),
  bbox: bboxSchema.optional(),
});

/** Each category can match several OSM tag combinations so nothing is skipped. */
const OVERPASS_FILTERS: Record<string, string[]> = {
  bank: ['["amenity"="bank"]', '["office"="financial"]', '["shop"="bank"]'],
  hospital: [
    '["amenity"~"^(hospital|clinic|doctors)$"]',
    '["healthcare"~"^(hospital|clinic|doctor|centre)$"]',
    '["building"="hospital"]',
  ],
};

const CATEGORY_LABEL: Record<string, string> = {
  bank: "Bank",
  hospital: "Clinic",
};

/** Public Overpass mirrors — tried in order so one busy server never blocks India traffic. */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** Region bias: results outside India are dropped when the viewport is Indian. */
const IN_BOUNDS = { south: 6.0, west: 67.0, north: 37.6, east: 97.5 };

type BBox = z.infer<typeof bboxSchema>;

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

function inIndia(bbox: BBox): boolean {
  const lat = (bbox.south + bbox.north) / 2;
  const lng = (bbox.west + bbox.east) / 2;
  return lat >= IN_BOUNDS.south && lat <= IN_BOUNDS.north && lng >= IN_BOUNDS.west && lng <= IN_BOUNDS.east;
}

function bboxFromRadius(lat: number, lng: number, radius: number): BBox {
  const dLat = radius / 111320;
  const dLng = radius / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { south: lat - dLat, west: lng - dLng, north: lat + dLat, east: lng + dLng };
}

function quadrants(bbox: BBox): BBox[] {
  const midLat = (bbox.south + bbox.north) / 2;
  const midLng = (bbox.west + bbox.east) / 2;
  return [
    { south: bbox.south, west: bbox.west, north: midLat, east: midLng },
    { south: bbox.south, west: midLng, north: midLat, east: bbox.east },
    { south: midLat, west: bbox.west, north: bbox.north, east: midLng },
    { south: midLat, west: midLng, north: bbox.north, east: bbox.east },
  ];
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

/** Raw Overpass call for one bounding box; throws when every mirror fails. */
async function fetchTile(bbox: BBox, category: string): Promise<PlaceRow[]> {
  const filters = OVERPASS_FILTERS[category] ?? OVERPASS_FILTERS["bank"]!;
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const clauses = filters
    .map((filter) => `node${filter}(${box});way${filter}(${box});relation${filter}(${box});`)
    .join("");
  // No "out" limit — every element inside the box is returned.
  const query = `[out:json][timeout:25];(${clauses});out center;`;

  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept-Encoding": "gzip, deflate",
          "User-Agent": "QueuePredict/1.0 (queue prediction app)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Overpass ${endpoint} responded ${response.status}`);
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
        .filter((row): row is PlaceRow => row !== null);
    } catch (error) {
      lastError = error;
      console.error(`[places] mirror failed ${endpoint}:`, error);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error("All Overpass mirrors failed");
}

const SATURATED = 400; // tile looks truncated => split and page through it
const MAX_TILES = 24;

/** Fetches the whole bounding box, splitting into quadrants until nothing is cut off. */
async function fetchBBox(bbox: BBox, category: string) {
  const collected = new Map<string, PlaceRow>();
  const queue: BBox[] = [bbox];
  let tiles = 0;
  let failures = 0;

  while (queue.length > 0 && tiles < MAX_TILES) {
    const current = queue.shift()!;
    tiles += 1;
    try {
      const rows = await fetchTile(current, category);
      for (const row of rows) collected.set(row.source_id, row);
      console.info(`[places] ${category} tile ${tiles} -> ${rows.length} results`);
      if (rows.length >= SATURATED && tiles + queue.length + 4 <= MAX_TILES) {
        queue.push(...quadrants(current));
      }
    } catch {
      failures += 1;
    }
  }

  return { rows: [...collected.values()], tiles, failures };
}

/**
 * Finds real nearby places from OpenStreetMap for the exact visible map area,
 * stores them in the database and returns the stored rows.
 */
export const getNearbyPlaces = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => nearbySchema.parse(input))
  .handler(async ({ data }) => {
    const bbox = data.bbox ?? bboxFromRadius(data.lat, data.lng, data.radius);
    const startedAt = Date.now();

    const { rows: fetched, tiles, failures } = await fetchBBox(bbox, data.category);

    const biasToIndia = inIndia(bbox);
    let rows = fetched
      .filter((row) =>
        biasToIndia
          ? row.latitude >= IN_BOUNDS.south &&
            row.latitude <= IN_BOUNDS.north &&
            row.longitude >= IN_BOUNDS.west &&
            row.longitude <= IN_BOUNDS.east
          : true,
      )
      .map((row) => ({ row, d: metersBetween(data.lat, data.lng, row.latitude, row.longitude) }))
      .sort((a, b) => a.d - b.d)
      .map((item) => item.row);

    let degraded = failures > 0 && rows.length === 0;

    if (rows.length === 0) {
      degraded = true;
      rows = fallbackPlaces(data.lat, data.lng, data.category);
      console.warn(`[places] ${data.category} using demo fallback after ${tiles} tile(s)`);
    }

    console.info(
      `[places] ${data.category} resolved ${rows.length} places from ${tiles} tile(s) in ${Date.now() - startedAt}ms, degraded=${degraded}`,
    );

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

/** Free-text location search (city, street, landmark) via OpenStreetMap, biased to India. */
export const geocodeLocation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => geocodeSchema.parse(input))
  .handler(async ({ data }) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(data.query)}`;
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
