REVOKE ALL ON FUNCTION public.crowd_reports_score_prediction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crowd_reports_normalize() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_place_hourly_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qp_predict_wait(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qp_train_ridge(numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.qp_eligible_places(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.refresh_place_hourly_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.qp_predict_wait(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.qp_train_ridge(numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.qp_eligible_places(integer) TO service_role;