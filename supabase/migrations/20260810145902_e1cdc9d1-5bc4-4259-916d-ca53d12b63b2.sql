CREATE OR REPLACE FUNCTION public.qp_predict_wait(p_place_id uuid, p_at timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  pl record;
  has_model boolean := false;
  baseline numeric;
  recent_avg numeric;
  recent_cnt numeric;
  counters numeric;
  svc text;
  feats numeric[];
  heuristic numeric;
  ml numeric;
  served numeric;
  blend numeric := 0;
  mode text := 'heuristic';
  weight_sum numeric := 0;
  score_sum numeric := 0;
  i integer;
BEGIN
  SELECT * INTO pl FROM public.places WHERE id = p_place_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'unknown place');
  END IF;

  SELECT avg_wait_mins INTO baseline
    FROM public.place_hourly_stats
   WHERE place_id = p_place_id
     AND day_of_week = EXTRACT(dow FROM p_at)::smallint
     AND hour_of_day = EXTRACT(hour FROM p_at)::smallint;

  SELECT sum(estimated_wait_mins * wt), sum(wt)
    INTO score_sum, weight_sum
    FROM (
      SELECT estimated_wait_mins,
             trust_weight / (1 + EXTRACT(epoch FROM (p_at - created_at)) / 3600.0) AS wt
        FROM public.crowd_reports
       WHERE place_id = p_place_id
         AND created_at > p_at - interval '6 hours'
         AND created_at <= p_at
    ) s;

  IF weight_sum IS NOT NULL AND weight_sum > 0 THEN
    heuristic := score_sum / weight_sum;
  ELSE
    heuristic := COALESCE(baseline, 12);
  END IF;

  SELECT avg(estimated_wait_mins), count(*) INTO recent_avg, recent_cnt
    FROM public.crowd_reports
   WHERE place_id = p_place_id
     AND created_at > p_at - interval '3 hours'
     AND created_at <= p_at;

  SELECT max(counters_open) INTO counters
    FROM public.crowd_reports
   WHERE place_id = p_place_id AND created_at > p_at - interval '3 hours';

  svc := COALESCE(pl.category, 'bank');

  SELECT * INTO m FROM public.model_artifacts WHERE is_active ORDER BY version DESC LIMIT 1;
  has_model := FOUND;

  IF has_model AND p_place_id = ANY(m.eligible_place_ids) THEN
    feats := public.qp_build_features(baseline, pl.total_counters, p_at, recent_avg, recent_cnt, counters, svc);
    ml := m.intercept;
    FOR i IN 1..array_length(feats, 1) LOOP
      ml := ml + (m.weights ->> (i - 1))::numeric * feats[i];
    END LOOP;
    ml := GREATEST(1, LEAST(240, ml));

    IF m.mode = 'blend' AND m.ml_mae IS NOT NULL AND m.heuristic_mae IS NOT NULL
       AND m.ml_mae < m.heuristic_mae THEN
      blend := LEAST(0.6, 0.2 + 0.05 * LEAST(8, COALESCE(recent_cnt, 0)));
      mode := 'blend';
    ELSE
      mode := 'shadow';
    END IF;
  END IF;

  served := round((1 - blend) * heuristic + blend * COALESCE(ml, heuristic));

  INSERT INTO public.prediction_shadow_log (place_id, model_version, heuristic_wait, ml_wait, served_wait, mode)
  VALUES (p_place_id, CASE WHEN has_model THEN m.version END, round(heuristic), round(ml), served, mode);

  RETURN jsonb_build_object(
    'place_id', p_place_id,
    'wait', served,
    'heuristic_wait', round(heuristic),
    'ml_wait', round(ml),
    'blend_weight', blend,
    'mode', mode,
    'model_version', CASE WHEN has_model THEN m.version END,
    'report_count', COALESCE(recent_cnt, 0),
    'is_estimate', weight_sum IS NULL OR weight_sum = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qp_predict_wait(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qp_predict_wait(uuid, timestamptz) TO service_role;