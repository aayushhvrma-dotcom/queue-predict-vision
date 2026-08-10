import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server-side wait-time prediction.
 *
 * Inference runs entirely inside the database (`public.qp_predict_wait`), so the
 * Ridge model weights stored in `model_artifacts` never reach the browser.
 * While a model is in `shadow` mode the served value is the existing heuristic;
 * the ML value is still computed and logged so accuracy can be compared.
 */

const predictSchema = z.object({
  placeIds: z.array(z.string().uuid()).min(1).max(60),
});

export type PlacePrediction = {
  place_id: string;
  wait: number;
  heuristic_wait: number;
  ml_wait: number | null;
  blend_weight: number;
  mode: "heuristic" | "shadow" | "blend";
  model_version: number | null;
  report_count: number;
  is_estimate: boolean;
};

export const getPlacePredictions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => predictSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results = await Promise.all(
      data.placeIds.map(async (placeId) => {
        const { data: row, error } = await supabaseAdmin.rpc("qp_predict_wait", {
          p_place_id: placeId,
        });
        if (error) {
          console.error(`qp_predict_wait failed for ${placeId}:`, error.message);
          return null;
        }
        return row as unknown as PlacePrediction;
      }),
    );

    return {
      predictions: results.filter(
        (row): row is PlacePrediction => row !== null && !("error" in row),
      ),
    };
  });

/** Internal health view of the current model: never exposes weights. */
export const getModelStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("model_artifacts")
    .select("version, trained_at, sample_count, mode, ml_mae, heuristic_mae, eligible_place_ids")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { trained: false as const };

  return {
    trained: true as const,
    version: data.version,
    trainedAt: data.trained_at,
    sampleCount: data.sample_count,
    mode: data.mode,
    mlMae: data.ml_mae,
    heuristicMae: data.heuristic_mae,
    eligiblePlaces: data.eligible_place_ids?.length ?? 0,
  };
});
