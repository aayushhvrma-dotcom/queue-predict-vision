CREATE OR REPLACE FUNCTION public.normalize_count(raw text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
  avg_val numeric;
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

  SELECT avg(m[1]::numeric) INTO avg_val
    FROM regexp_matches(v, '(\d+(?:\.\d+)?)', 'g') AS m;

  IF avg_val IS NULL THEN RETURN NULL; END IF;

  RETURN GREATEST(0, LEAST(999, round(avg_val)::integer));
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_count(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_count(text) TO authenticated, service_role;

UPDATE public.crowd_reports
   SET counters_open = public.normalize_count(counters_open_raw)
 WHERE counters_open_raw IS NOT NULL;
UPDATE public.crowd_reports
   SET people_ahead = public.normalize_count(people_ahead_raw)
 WHERE people_ahead_raw IS NOT NULL;