-- Soft-launch monthly cap for AI Coach.
-- Reuses public.coach_usage (one row per user per UTC day).
-- Counts a message only when this function runs, which the API does after a
-- successful provider response. Failed provider calls are not recorded.
-- The limit is a constant. user_id comes from auth.uid(), never from the client.

CREATE OR REPLACE FUNCTION public.coach_monthly_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit CONSTANT INTEGER := 10;
  v_user_id UUID := auth.uid();
  v_start DATE := date_trunc('month', (NOW() AT TIME ZONE 'UTC'))::date;
  v_end DATE := (v_start + INTERVAL '1 month')::date;
  v_used INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'coach_monthly_status requires an authenticated session'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COALESCE(SUM(count), 0)
    INTO v_used
    FROM public.coach_usage
   WHERE user_id = v_user_id
     AND usage_date >= v_start
     AND usage_date < v_end;

  RETURN jsonb_build_object(
    'allowed', v_used < v_limit,
    'used', v_used,
    'remaining', GREATEST(v_limit - v_used, 0),
    'monthly_limit', v_limit,
    'plan', 'free'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.coach_record_successful_message()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit CONSTANT INTEGER := 10;
  v_user_id UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::date;
  v_start DATE := date_trunc('month', (NOW() AT TIME ZONE 'UTC'))::date;
  v_end DATE := (v_start + INTERVAL '1 month')::date;
  v_used INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'coach_record_successful_message requires an authenticated session'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text));

  SELECT COALESCE(SUM(count), 0)
    INTO v_used
    FROM public.coach_usage
   WHERE user_id = v_user_id
     AND usage_date >= v_start
     AND usage_date < v_end;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'remaining', 0,
      'monthly_limit', v_limit,
      'plan', 'free'
    );
  END IF;

  INSERT INTO public.coach_usage (user_id, usage_date, count)
  VALUES (v_user_id, v_today, 1)
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET count = public.coach_usage.count + 1;

  v_used := v_used + 1;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used,
    'remaining', GREATEST(v_limit - v_used, 0),
    'monthly_limit', v_limit,
    'plan', 'free'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.coach_monthly_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.coach_record_successful_message() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_monthly_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_record_successful_message() TO authenticated;
