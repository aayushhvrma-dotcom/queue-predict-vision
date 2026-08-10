-- ============================================================
-- Phase 1: schema extensions (all additive, nullable / defaulted)
-- ============================================================

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS total_counters integer;

ALTER TABLE public.crowd_reports
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS counters_open_raw text,
  ADD COLUMN IF NOT EXISTS counters_open integer,
  ADD COLUMN IF NOT EXISTS people_ahead_raw text,
  ADD COLUMN IF NOT EXISTS people_ahead integer,
  ADD COLUMN IF NOT EXISTS trust_weight numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS predicted_wait_mins integer,
  ADD COLUMN IF NOT EXISTS prediction_accuracy numeric;

CREATE INDEX IF NOT EXISTS crowd_reports_place_created_idx
  ON public.crowd_reports (place_id, created_at DESC);

-- ============================================================
-- Phase 2: tolerant normalisation of messy counter values
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_count(raw text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
  nums numeric[];
BEGIN
  IF raw IS NULL THEN RETURN NULL; END IF;
  v := lower(btrim(raw));
  IF v = '' THEN RETURN NULL; END IF;

  IF v IN ('not_sure', 'not sure', 'unknown', 'unsure', 'n/a', 'na', 'idk', '-') THEN
    RETURN NULL;
  END IF;
  IF v IN ('no', 'none', 'closed', 'empty', 'false') THEN RETURN 0; END IF;
  IF v IN ('yes', 'open', 'true', 'some') THEN RETURN 1; END IF;
  IF v IN ('few', 'a few') THEN RETURN 3; END IF;
  IF v IN ('many', 'lots', 'crowded', 'a lot') THEN RETURN 15; END IF;

  SELECT array_agg(m[1]::numeric) INTO nums
  FROM regexp_matches(v, '\d+(\.\d+)?', 'g') AS m;

  IF nums IS NULL OR array_length(nums, 1) = 0 THEN RETURN NULL; END IF;

  -- "5-10" / "5 to 10" -> midpoint; single number -> itself
  RETURN GREATEST(0, LEAST(999, round((
    SELECT avg(n) FROM unnest(nums) AS n
  ))::integer));
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_count(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.crowd_reports_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.counters_open IS NULL AND NEW.counters_open_raw IS NOT NULL THEN
    NEW.counters_open := public.normalize_count(NEW.counters_open_raw);
  END IF;
  IF NEW.people_ahead IS NULL AND NEW.people_ahead_raw IS NOT NULL THEN
    NEW.people_ahead := public.normalize_count(NEW.people_ahead_raw);
  END IF;
  IF NEW.trust_weight IS NULL OR NEW.trust_weight <= 0 THEN
    NEW.trust_weight := 1.0;
  END IF;
  NEW.trust_weight := LEAST(3.0, NEW.trust_weight);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crowd_reports_normalize_trg ON public.crowd_reports;
CREATE TRIGGER crowd_reports_normalize_trg
  BEFORE INSERT OR UPDATE ON public.crowd_reports
  FOR EACH ROW EXECUTE FUNCTION public.crowd_reports_normalize();

-- backfill any existing raw values
UPDATE public.crowd_reports
   SET counters_open = public.normalize_count(counters_open_raw)
 WHERE counters_open IS NULL AND counters_open_raw IS NOT NULL;
UPDATE public.crowd_reports
   SET people_ahead = public.normalize_count(people_ahead_raw)
 WHERE people_ahead IS NULL AND people_ahead_raw IS NOT NULL;

-- ============================================================
-- Phase 3: hourly baselines per place
-- ============================================================

CREATE TABLE IF NOT EXISTS public.place_hourly_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL,
  hour_of_day smallint NOT NULL,
  avg_wait_mins numeric NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, day_of_week, hour_of_day)
);

GRANT SELECT ON public.place_hourly_stats TO anon, authenticated;
GRANT ALL ON public.place_hourly_stats TO service_role;
ALTER TABLE public.place_hourly_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hourly stats are public" ON public.place_hourly_stats
  FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.refresh_place_hourly_stats()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched integer;
BEGIN
  INSERT INTO public.place_hourly_stats (place_id, day_of_week, hour_of_day, avg_wait_mins, sample_count, updated_at)
  SELECT r.place_id,
         EXTRACT(dow FROM r.created_at)::smallint,
         EXTRACT(hour FROM r.created_at)::smallint,
         avg(r.estimated_wait_mins)::numeric,
         count(*)::integer,
         now()
    FROM public.crowd_reports r
   WHERE r.created_at > now() - interval '120 days'
   GROUP BY 1, 2, 3
  ON CONFLICT (place_id, day_of_week, hour_of_day) DO UPDATE
    SET avg_wait_mins = EXCLUDED.avg_wait_mins,
        sample_count  = EXCLUDED.sample_count,
        updated_at    = now();
  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_place_hourly_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_place_hourly_stats() TO service_role;

-- ============================================================
-- Phase 4: model artifacts (private) + shadow log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.model_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL,
  algorithm text NOT NULL DEFAULT 'ridge',
  trained_at timestamptz NOT NULL DEFAULT now(),
  sample_count integer NOT NULL,
  feature_names jsonb NOT NULL,
  weights jsonb NOT NULL,
  intercept numeric NOT NULL DEFAULT 0,
  lambda numeric NOT NULL DEFAULT 1.0,
  eligible_place_ids uuid[] NOT NULL DEFAULT '{}',
  mode text NOT NULL DEFAULT 'shadow',
  ml_mae numeric,
  heuristic_mae numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_artifacts_mode_chk CHECK (mode IN ('shadow', 'blend')),
  UNIQUE (version)
);

-- Model weights are backend-only: no anon/authenticated grants on purpose.
GRANT ALL ON public.model_artifacts TO service_role;
ALTER TABLE public.model_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages model artifacts" ON public.model_artifacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.prediction_shadow_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  model_version integer,
  heuristic_wait numeric NOT NULL,
  ml_wait numeric,
  served_wait numeric NOT NULL,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prediction_shadow_log_place_idx
  ON public.prediction_shadow_log (place_id, created_at DESC);

GRANT ALL ON public.prediction_shadow_log TO service_role;
ALTER TABLE public.prediction_shadow_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages shadow log" ON public.prediction_shadow_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- Phase 5: feedback loop -- score the last prediction on new reports
-- ============================================================

CREATE OR REPLACE FUNCTION public.crowd_reports_score_prediction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_pred numeric;
BEGIN
  IF NEW.predicted_wait_mins IS NULL THEN
    SELECT served_wait INTO last_pred
      FROM public.prediction_shadow_log
     WHERE place_id = NEW.place_id
       AND created_at > NEW.created_at - interval '3 hours'
       AND created_at <= NEW.created_at
     ORDER BY created_at DESC
     LIMIT 1;
    IF last_pred IS NOT NULL THEN
      NEW.predicted_wait_mins := round(last_pred)::integer;
    END IF;
  END IF;

  IF NEW.predicted_wait_mins IS NOT NULL THEN
    NEW.prediction_accuracy := GREATEST(0, 1 - (
      abs(NEW.predicted_wait_mins - NEW.estimated_wait_mins)::numeric
      / GREATEST(5, NEW.estimated_wait_mins)::numeric
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crowd_reports_score_prediction_trg ON public.crowd_reports;
CREATE TRIGGER crowd_reports_score_prediction_trg
  BEFORE INSERT ON public.crowd_reports
  FOR EACH ROW EXECUTE FUNCTION public.crowd_reports_score_prediction();

-- ============================================================
-- Phase 6: feature builder shared by training and inference
-- ============================================================

CREATE OR REPLACE FUNCTION public.qp_feature_names()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'baseline_wait','total_counters','sin_hour','cos_hour','sin_dow','cos_dow',
    'is_weekend','recent3h_avg','recent3h_count','counters_open_norm',
    'svc_hospital','svc_pharmacy','svc_post_office','svc_government'
  ];
$$;

CREATE OR REPLACE FUNCTION public.qp_build_features(
  p_baseline numeric,
  p_total_counters numeric,
  p_at timestamptz,
  p_recent_avg numeric,
  p_recent_count numeric,
  p_counters_open numeric,
  p_service_type text
) RETURNS numeric[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  h numeric := EXTRACT(hour FROM p_at);
  d numeric := EXTRACT(dow FROM p_at);
  tc numeric := COALESCE(NULLIF(p_total_counters, 0), 4);
  svc text := lower(COALESCE(p_service_type, 'bank'));
BEGIN
  RETURN ARRAY[
    COALESCE(p_baseline, 12),
    COALESCE(p_total_counters, 0),
    sin(2 * pi() * h / 24),
    cos(2 * pi() * h / 24),
    sin(2 * pi() * d / 7),
    cos(2 * pi() * d / 7),
    CASE WHEN d IN (0, 6) THEN 1 ELSE 0 END,
    COALESCE(p_recent_avg, COALESCE(p_baseline, 12)),
    COALESCE(p_recent_count, 0),
    LEAST(1, COALESCE(p_counters_open, tc) / tc),
    CASE WHEN svc = 'hospital' THEN 1 ELSE 0 END,
    CASE WHEN svc = 'pharmacy' THEN 1 ELSE 0 END,
    CASE WHEN svc = 'post_office' THEN 1 ELSE 0 END,
    CASE WHEN svc = 'government' THEN 1 ELSE 0 END
  ]::numeric[];
END;
$$;

-- ============================================================
-- Phase 7: Ridge regression training (offline, in Postgres)
-- ============================================================

CREATE OR REPLACE FUNCTION public.qp_eligible_places(min_reports integer DEFAULT 30)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(place_id), '{}')
  FROM (
    SELECT place_id
      FROM public.crowd_reports
     WHERE created_at > now() - interval '120 days'
     GROUP BY place_id
    HAVING count(*) >= min_reports
       AND COALESCE(stddev_samp(estimated_wait_mins), 0) >= 3
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.qp_train_ridge(p_lambda numeric DEFAULT 1.0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  names text[] := public.qp_feature_names();
  p integer := array_length(names, 1);
  n integer := array_length(names, 1) + 1;   -- + intercept
  a double precision[][];
  x double precision[];
  y double precision;
  w double precision;
  rec record;
  i integer; j integer; c integer; r integer; maxr integer;
  piv double precision; f double precision; tmp double precision;
  samples integer := 0;
  eligible uuid[];
  weights numeric[] := '{}';
  intercept numeric;
  ml_err numeric := 0; heur_err numeric := 0; err_n integer := 0;
  pred double precision;
  next_version integer;
BEGIN
  eligible := public.qp_eligible_places(30);
  IF eligible IS NULL OR array_length(eligible, 1) IS NULL THEN
    RETURN jsonb_build_object('trained', false, 'reason', 'no eligible places');
  END IF;

  -- augmented normal-equation matrix, ridge-initialised (intercept unpenalised)
  a := array_fill(0::double precision, ARRAY[n, n + 1]);
  FOR i IN 2..n LOOP
    a[i][i] := p_lambda::double precision;
  END LOOP;

  FOR rec IN
    SELECT r.estimated_wait_mins::double precision AS target,
           r.trust_weight::double precision AS weight,
           public.qp_build_features(
             hs.avg_wait_mins,
             pl.total_counters,
             r.created_at,
             r.recent_avg,
             r.recent_cnt,
             r.counters_open,
             COALESCE(r.service_type, pl.category)
           ) AS feats
      FROM (
        SELECT cr.*,
               avg(cr.estimated_wait_mins) OVER win AS recent_avg,
               count(*) OVER win AS recent_cnt
          FROM public.crowd_reports cr
         WHERE cr.created_at > now() - interval '120 days'
        WINDOW win AS (
          PARTITION BY cr.place_id ORDER BY cr.created_at
          RANGE BETWEEN interval '3 hours' PRECEDING AND interval '1 second' PRECEDING
        )
      ) r
      JOIN public.places pl ON pl.id = r.place_id
      LEFT JOIN public.place_hourly_stats hs
             ON hs.place_id = r.place_id
            AND hs.day_of_week = EXTRACT(dow FROM r.created_at)::smallint
            AND hs.hour_of_day = EXTRACT(hour FROM r.created_at)::smallint
     WHERE r.place_id = ANY(eligible)
  LOOP
    x := ARRAY[1::double precision] || rec.feats::double precision[];
    y := rec.target;
    w := GREATEST(0.1, COALESCE(rec.weight, 1));
    samples := samples + 1;
    FOR i IN 1..n LOOP
      FOR j IN 1..n LOOP
        a[i][j] := a[i][j] + w * x[i] * x[j];
      END LOOP;
      a[i][n + 1] := a[i][n + 1] + w * x[i] * y;
    END LOOP;
  END LOOP;

  IF samples < 30 THEN
    RETURN jsonb_build_object('trained', false, 'reason', 'not enough samples', 'samples', samples);
  END IF;

  -- Gauss-Jordan elimination with partial pivoting
  FOR i IN 1..n LOOP
    maxr := i;
    FOR r IN i..n LOOP
      IF abs(a[r][i]) > abs(a[maxr][i]) THEN maxr := r; END IF;
    END LOOP;
    IF abs(a[maxr][i]) < 1e-9 THEN
      RETURN jsonb_build_object('trained', false, 'reason', 'singular matrix');
    END IF;
    IF maxr <> i THEN
      FOR c IN 1..(n + 1) LOOP
        tmp := a[i][c]; a[i][c] := a[maxr][c]; a[maxr][c] := tmp;
      END LOOP;
    END IF;
    piv := a[i][i];
    FOR c IN i..(n + 1) LOOP a[i][c] := a[i][c] / piv; END LOOP;
    FOR r IN 1..n LOOP
      IF r <> i THEN
        f := a[r][i];
        IF f <> 0 THEN
          FOR c IN i..(n + 1) LOOP a[r][c] := a[r][c] - f * a[i][c]; END LOOP;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  intercept := a[1][n + 1]::numeric;
  FOR i IN 2..n LOOP
    weights := weights || a[i][n + 1]::numeric;
  END LOOP;

  -- in-sample accuracy comparison vs the heuristic baseline (shadow evaluation)
  FOR rec IN
    SELECT r.estimated_wait_mins::double precision AS target,
           COALESCE(r.recent_avg, hs.avg_wait_mins, 12)::double precision AS heuristic,
           public.qp_build_features(
             hs.avg_wait_mins, pl.total_counters, r.created_at,
             r.recent_avg, r.recent_cnt, r.counters_open,
             COALESCE(r.service_type, pl.category)
           ) AS feats
      FROM (
        SELECT cr.*,
               avg(cr.estimated_wait_mins) OVER win AS recent_avg,
               count(*) OVER win AS recent_cnt
          FROM public.crowd_reports cr
         WHERE cr.created_at > now() - interval '120 days'
        WINDOW win AS (
          PARTITION BY cr.place_id ORDER BY cr.created_at
          RANGE BETWEEN interval '3 hours' PRECEDING AND interval '1 second' PRECEDING
        )
      ) r
      JOIN public.places pl ON pl.id = r.place_id
      LEFT JOIN public.place_hourly_stats hs
             ON hs.place_id = r.place_id
            AND hs.day_of_week = EXTRACT(dow FROM r.created_at)::smallint
            AND hs.hour_of_day = EXTRACT(hour FROM r.created_at)::smallint
     WHERE r.place_id = ANY(eligible)
  LOOP
    pred := intercept::double precision;
    FOR i IN 1..p LOOP
      pred := pred + weights[i]::double precision * (rec.feats)[i]::double precision;
    END LOOP;
    ml_err := ml_err + abs(pred - rec.target);
    heur_err := heur_err + abs(rec.heuristic - rec.target);
    err_n := err_n + 1;
  END LOOP;

  SELECT COALESCE(max(version), 0) + 1 INTO next_version FROM public.model_artifacts;

  UPDATE public.model_artifacts SET is_active = false WHERE is_active;

  INSERT INTO public.model_artifacts (
    version, algorithm, sample_count, feature_names, weights, intercept,
    lambda, eligible_place_ids, mode, ml_mae, heuristic_mae, is_active
  ) VALUES (
    next_version, 'ridge', samples, to_jsonb(names), to_jsonb(weights), intercept,
    p_lambda, eligible, 'shadow',
    CASE WHEN err_n > 0 THEN ml_err / err_n ELSE NULL END,
    CASE WHEN err_n > 0 THEN heur_err / err_n ELSE NULL END,
    true
  );

  RETURN jsonb_build_object(
    'trained', true, 'version', next_version, 'samples', samples,
    'eligible_places', array_length(eligible, 1),
    'ml_mae', CASE WHEN err_n > 0 THEN ml_err / err_n END,
    'heuristic_mae', CASE WHEN err_n > 0 THEN heur_err / err_n END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qp_train_ridge(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qp_train_ridge(numeric) TO service_role;
REVOKE ALL ON FUNCTION public.qp_eligible_places(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qp_eligible_places(integer) TO service_role;

-- ============================================================
-- Phase 8: server-side inference (weights never leave the database)
-- ============================================================

CREATE OR REPLACE FUNCTION public.qp_predict_wait(p_place_id uuid, p_at timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  pl record;
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
  IF pl IS NULL THEN
    RETURN jsonb_build_object('error', 'unknown place');
  END IF;

  SELECT avg_wait_mins INTO baseline
    FROM public.place_hourly_stats
   WHERE place_id = p_place_id
     AND day_of_week = EXTRACT(dow FROM p_at)::smallint
     AND hour_of_day = EXTRACT(hour FROM p_at)::smallint;

  -- existing heuristic: recency-weighted live reports over 6h, else baseline, else 12
  SELECT sum(estimated_wait_mins * wt), sum(wt), count(*)
    INTO score_sum, weight_sum, recent_cnt
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

  IF m IS NOT NULL AND p_place_id = ANY(m.eligible_place_ids) THEN
    feats := public.qp_build_features(baseline, pl.total_counters, p_at, recent_avg, recent_cnt, counters, svc);
    ml := m.intercept;
    FOR i IN 1..array_length(feats, 1) LOOP
      ml := ml + (m.weights ->> (i - 1))::numeric * feats[i];
    END LOOP;
    ml := GREATEST(1, LEAST(240, ml));

    IF m.mode = 'blend' AND m.ml_mae IS NOT NULL AND m.heuristic_mae IS NOT NULL
       AND m.ml_mae < m.heuristic_mae THEN
      -- smooth blend, capped: more live reports -> more weight on ML
      blend := LEAST(0.6, 0.2 + 0.05 * LEAST(8, COALESCE(recent_cnt, 0)));
      mode := 'blend';
    ELSE
      mode := 'shadow';
    END IF;
  END IF;

  served := round((1 - blend) * heuristic + blend * COALESCE(ml, heuristic));

  INSERT INTO public.prediction_shadow_log (place_id, model_version, heuristic_wait, ml_wait, served_wait, mode)
  VALUES (p_place_id, m.version, round(heuristic), round(ml), served, mode);

  RETURN jsonb_build_object(
    'place_id', p_place_id,
    'wait', served,
    'heuristic_wait', round(heuristic),
    'ml_wait', round(ml),
    'blend_weight', blend,
    'mode', mode,
    'model_version', m.version,
    'report_count', COALESCE(recent_cnt, 0),
    'is_estimate', weight_sum IS NULL OR weight_sum = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.qp_predict_wait(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qp_predict_wait(uuid, timestamptz) TO service_role;

-- ============================================================
-- Phase 9: scheduled maintenance (stats hourly, retrain nightly)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('qp-refresh-hourly-stats')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'qp-refresh-hourly-stats');
SELECT cron.unschedule('qp-retrain-ridge')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'qp-retrain-ridge');

SELECT cron.schedule(
  'qp-refresh-hourly-stats', '7 * * * *',
  $cron$ SELECT public.refresh_place_hourly_stats(); $cron$
);

SELECT cron.schedule(
  'qp-retrain-ridge', '20 3 * * *',
  $cron$ SELECT public.qp_train_ridge(1.0); $cron$
);
