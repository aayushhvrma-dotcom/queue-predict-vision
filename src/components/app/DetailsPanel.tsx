import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Clock, Users, Bookmark, BookmarkCheck, Flag, Navigation } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildForecast, formatDistance, levelMeta } from "@/lib/queue";
import type { MapPlace } from "./MapCanvas";

type DetailsPanelProps = {
  place: MapPlace | null;
  distanceKm: number | null;
  saved: boolean;
  savingBusy: boolean;
  onClose: () => void;
  onToggleSave: () => void;
  onReport: () => void;
};

export function DetailsPanel({
  place,
  distanceKm,
  saved,
  savingBusy,
  onClose,
  onToggleSave,
  onReport,
}: DetailsPanelProps) {
  return (
    <AnimatePresence>
      {place && (
        <motion.aside
          key={place.id}
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "-100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="qp-card pointer-events-auto fixed inset-x-0 bottom-16 z-[1200] max-h-[70vh] overflow-y-auto rounded-t-3xl p-5 md:bottom-4 md:left-24 md:right-auto md:top-4 md:max-h-none md:w-[380px] md:rounded-3xl"
        >
          <PanelBody
            place={place}
            distanceKm={distanceKm}
            saved={saved}
            savingBusy={savingBusy}
            onClose={onClose}
            onToggleSave={onToggleSave}
            onReport={onReport}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function PanelBody({
  place,
  distanceKm,
  saved,
  savingBusy,
  onClose,
  onToggleSave,
  onReport,
}: DetailsPanelProps & { place: MapPlace }) {
  const meta = levelMeta(place.summary.level);
  const forecast = buildForecast(place.id, place.summary.wait);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-qp-text">{place.name}</h2>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-qp-muted">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {place.address ?? "Address unavailable"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-full bg-white/5 p-2 text-qp-muted transition-colors hover:bg-white/10 hover:text-qp-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/5 p-3">
          <p className="text-[11px] uppercase tracking-wider text-qp-muted">Distance</p>
          <p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-qp-text">
            <Navigation className="h-4 w-4 text-qp-primary-soft" />
            {distanceKm == null ? "—" : formatDistance(distanceKm)}
          </p>
        </div>
        <div className="rounded-2xl bg-white/5 p-3">
          <p className="text-[11px] uppercase tracking-wider text-qp-muted">Est. wait</p>
          <p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-qp-text">
            <Clock className="h-4 w-4 text-qp-primary-soft" />
            {place.summary.wait} min
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-qp-muted">Current crowd</p>
          <span className="text-[11px] text-qp-muted">
            {place.summary.isEstimate
              ? "AI estimate"
              : `${place.summary.reportCount} live report${place.summary.reportCount === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span
            className="qp-pulse relative inline-flex h-3 w-3 rounded-full"
            style={{ backgroundColor: meta.color, color: meta.color }}
          />
          <span className="text-lg font-semibold" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(meta.score / 5) * 100}%`, backgroundColor: meta.color }}
          />
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-white/5 p-4">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-qp-muted">
          <Users className="h-3.5 w-3.5" /> AI forecast · next 4 hours
        </p>
        <div className="mt-3 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecast} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
              <defs>
                <linearGradient id="qpForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9B5CFF" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#A9A3B8"
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <YAxis
                stroke="#A9A3B8"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={44}
                unit="m"
              />
              <Tooltip
                cursor={{ stroke: "#9B5CFF", strokeWidth: 1 }}
                contentStyle={{
                  background: "#211D2B",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  color: "#F5F3FF",
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value} min`, "Predicted wait"]}
              />
              <Area
                type="monotone"
                dataKey="wait"
                stroke="#9B5CFF"
                strokeWidth={2}
                fill="url(#qpForecast)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 flex gap-2 pb-1">
        <button
          type="button"
          onClick={onReport}
          className="qp-gradient flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Flag className="h-4 w-4" /> Report crowd
        </button>
        <button
          type="button"
          onClick={onToggleSave}
          disabled={savingBusy}
          className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-qp-text transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {saved ? (
            <BookmarkCheck className="h-4 w-4 text-qp-primary-soft" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
