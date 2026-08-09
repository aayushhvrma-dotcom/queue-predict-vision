export type CrowdLevel = "very_low" | "low" | "moderate" | "high" | "very_high";

export const CROWD_LEVELS: {
  value: CrowdLevel;
  label: string;
  score: number;
  color: string;
  defaultWait: number;
}[] = [
  { value: "very_low", label: "Very Low", score: 1, color: "#22C55E", defaultWait: 3 },
  { value: "low", label: "Low", score: 2, color: "#84CC16", defaultWait: 8 },
  { value: "moderate", label: "Moderate", score: 3, color: "#F59E0B", defaultWait: 18 },
  { value: "high", label: "High", score: 4, color: "#EF4444", defaultWait: 35 },
  { value: "very_high", label: "Very High", score: 5, color: "#DC2626", defaultWait: 55 },
];

export function levelFromScore(score: number): CrowdLevel {
  const clamped = Math.max(1, Math.min(5, Math.round(score)));
  return CROWD_LEVELS[clamped - 1]!.value;
}

export function levelMeta(level: CrowdLevel) {
  return CROWD_LEVELS.find((l) => l.value === level) ?? CROWD_LEVELS[2]!;
}

export const PLACE_CATEGORIES = [
  { value: "bank", label: "Banks" },
  { value: "hospital", label: "Hospitals" },
  { value: "pharmacy", label: "Pharmacies" },
  { value: "post_office", label: "Post offices" },
  { value: "government", label: "Government" },
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number]["value"];

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministic pseudo-random in [0,1) from a seed string. */
export function seeded(seed: string): number {
  return (hash(seed) % 10000) / 10000;
}

/**
 * Typical business rhythm multiplier for a given hour of day (0-23).
 * Peaks around lunch time and just after work.
 */
export function hourFactor(hour: number): number {
  const peaks = [
    { h: 11, w: 1 },
    { h: 13, w: 0.95 },
    { h: 17, w: 0.85 },
  ];
  let value = 0.25;
  for (const peak of peaks) {
    value += peak.w * Math.exp(-((hour - peak.h) ** 2) / 4);
  }
  if (hour < 8 || hour > 20) value *= 0.25;
  return Math.min(1.4, value);
}

export type ForecastPoint = { label: string; hour: number; wait: number; level: CrowdLevel };

/**
 * 4-hour ahead wait-time forecast, anchored on the currently observed wait and
 * modulated by the place's own rhythm. Deterministic per place + hour.
 */
export function buildForecast(
  placeId: string,
  currentWait: number,
  now = new Date(),
): ForecastPoint[] {
  const baseHour = now.getHours();
  const anchor = currentWait > 0 ? currentWait : 12;
  const points: ForecastPoint[] = [];

  for (let i = 0; i <= 4; i += 1) {
    const hour = (baseHour + i) % 24;
    const jitter = 0.75 + seeded(`${placeId}:${hour}`) * 0.5;
    const relative = hourFactor(hour) / Math.max(0.3, hourFactor(baseHour));
    const wait = Math.max(1, Math.round(anchor * relative * jitter));
    const score = Math.max(1, Math.min(5, Math.round(wait / 12) + 1));
    points.push({
      label: i === 0 ? "Now" : `${hour.toString().padStart(2, "0")}:00`,
      hour,
      wait,
      level: levelFromScore(score),
    });
  }

  return points;
}

export type CrowdSummary = {
  level: CrowdLevel;
  wait: number;
  reportCount: number;
  isEstimate: boolean;
};

/** Aggregate recent reports into a single crowd status (recency weighted). */
export function summarizeReports(
  placeId: string,
  reports: { crowd_level: CrowdLevel; estimated_wait_mins: number; created_at: string }[],
  now = new Date(),
): CrowdSummary {
  const recent = reports.filter(
    (r) => now.getTime() - new Date(r.created_at).getTime() < 6 * 60 * 60 * 1000,
  );

  if (recent.length === 0) {
    // No live signal: fall back to the AI baseline for this hour.
    const base = 8 + seeded(placeId) * 22;
    const wait = Math.max(2, Math.round(base * hourFactor(now.getHours())));
    const score = Math.max(1, Math.min(5, Math.round(wait / 12) + 1));
    return { level: levelFromScore(score), wait, reportCount: 0, isEstimate: true };
  }

  let weightSum = 0;
  let scoreSum = 0;
  let waitSum = 0;
  for (const report of recent) {
    const ageHours = (now.getTime() - new Date(report.created_at).getTime()) / 3600000;
    const weight = 1 / (1 + ageHours);
    weightSum += weight;
    scoreSum += levelMeta(report.crowd_level).score * weight;
    waitSum += report.estimated_wait_mins * weight;
  }

  return {
    level: levelFromScore(scoreSum / weightSum),
    wait: Math.round(waitSum / weightSum),
    reportCount: recent.length,
    isEstimate: false,
  };
}
