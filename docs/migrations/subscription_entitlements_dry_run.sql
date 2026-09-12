-- Mindful Space subscription entitlements
-- Review this SQL before running it in the Supabase SQL Editor.
-- This migration is intentionally not executed by the application or build.
--
-- Run after coach_usage.sql. It replaces coach_increment_usage() so the
-- atomic quota is selected from the server-owned entitlement row.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id    UUID NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  plan       TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'plus', 'pro')),
  region     TEXT NOT NULL DEFAULT 'global'
    CHECK (region IN ('global', 'indonesia', 'japan')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_entitlements_select_own" ON public.user_entitlements;
CREATE POLICY "user_entitlements_select_own"
  ON public.user_entitlements
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.user_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_entitlements TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user_entitlement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_entitlements (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_entitlement ON auth.users;
CREATE TRIGGER on_auth_user_created_entitlement
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_entitlement();

-- Remove the legacy hardcoded function signatures.
DROP FUNCTION IF EXISTS public.coach_increment_usage(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.coach_increment_usage(INTEGER);
DROP FUNCTION IF EXISTS public.coach_increment_usage();

-- Returns a JSON object so the API can display authoritative plan and quota
-- information without trusting a client-provided plan or limit.
CREATE OR REPLACE FUNCTION public.coach_increment_usage()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_plan TEXT;
  v_limit INTEGER;
  v_count INTEGER;
  v_date DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(plan, 'free')
    INTO v_plan
    FROM public.user_entitlements
   WHERE user_id = v_user_id;

  v_plan := CASE WHEN v_plan IN ('free', 'plus', 'pro') THEN v_plan ELSE 'free' END;
  v_limit := CASE v_plan
    WHEN 'pro' THEN 50
    WHEN 'plus' THEN 20
    ELSE 5
  END;

  INSERT INTO public.coach_usage (user_id, usage_date, count)
  VALUES (v_user_id, v_date, 1)
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET count = public.coach_usage.count + 1
    WHERE public.coach_usage.count < v_limit
  RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    SELECT count INTO v_count
      FROM public.coach_usage
     WHERE user_id = v_user_id AND usage_date = v_date;
    RETURN jsonb_build_object(
      'allowed', false,
      'used', COALESCE(v_count, v_limit),
      'remaining', 0,
      'daily_limit', v_limit,
      'plan', v_plan
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_count,
    'remaining', GREATEST(v_limit - v_count, 0),
    'daily_limit', v_limit,
    'plan', v_plan
  );
END;
$$;

REVOKE ALL ON FUNCTION public.coach_increment_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_increment_usage() TO authenticated;

-- Backfill existing accounts safely as Free. This does not change any plan
-- that has already been assigned.
INSERT INTO public.user_entitlements (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

ROLLBACK;