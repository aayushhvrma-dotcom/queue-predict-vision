import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";

import { CROWD_LEVELS, type CrowdLevel } from "@/lib/queue";

type ReportModalProps = {
  open: boolean;
  placeName: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (level: CrowdLevel, waitMins: number) => void;
};

export function ReportModal({
  open,
  placeName,
  submitting,
  error,
  onClose,
  onSubmit,
}: ReportModalProps) {
  const [level, setLevel] = useState<CrowdLevel>("moderate");
  const [wait, setWait] = useState("18");

  const waitValue = Number(wait);
  const waitInvalid = !Number.isFinite(waitValue) || waitValue < 0 || waitValue > 600;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Report crowd at ${placeName}`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            onClick={(event) => event.stopPropagation()}
            className="qp-card w-full max-w-md rounded-t-3xl p-6 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-qp-text">Report crowd</h2>
                <p className="mt-1 text-sm text-qp-muted">{placeName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close report form"
                className="rounded-full bg-white/5 p-2 text-qp-muted transition-colors hover:bg-white/10 hover:text-qp-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-5 text-[11px] uppercase tracking-wider text-qp-muted">
              How busy is it right now?
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {CROWD_LEVELS.map((option) => {
                const active = option.value === level;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setLevel(option.value);
                      setWait(String(option.defaultWait));
                    }}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors ${
                      active
                        ? "border-qp-primary-soft bg-white/10 text-qp-text"
                        : "border-white/10 bg-white/[0.03] text-qp-muted hover:bg-white/[0.07]"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: option.color }}
                      />
                      {option.label}
                    </span>
                    <span className="text-xs">~{option.defaultWait} min</span>
                  </button>
                );
              })}
            </div>

            <label className="mt-5 block text-[11px] uppercase tracking-wider text-qp-muted">
              Estimated waiting time (minutes)
            </label>
            <input
              type="number"
              min={0}
              max={600}
              value={wait}
              onChange={(event) => setWait(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-qp-text outline-none focus:border-qp-primary-soft"
            />
            {waitInvalid && (
              <p className="mt-2 text-xs text-qp-danger">Enter a value between 0 and 600.</p>
            )}
            {error && <p className="mt-3 text-sm text-qp-danger">{error}</p>}

            <button
              type="button"
              disabled={submitting || waitInvalid}
              onClick={() => onSubmit(level, Math.round(waitValue))}
              className="qp-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit report
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
