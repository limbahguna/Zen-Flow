-- KindEase Stress Check estimates.
-- Review-only migration. Run manually in the Supabase SQL Editor.
-- Do not execute from application startup.
--
-- Creates public.user_stress_estimates and adds
-- public.user_wellness_preferences.journal_sentiment_consent (default false).
-- Does not read or write journal text.

BEGIN;

ALTER TABLE public.user_wellness_preferences
  ADD COLUMN IF NOT EXISTS journal_sentiment_consent boolean NOT NULL DEFAULT false;

GRANT UPDATE (journal_sentiment_consent)
  ON TABLE public.user_wellness_preferences
  TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_stress_estimate_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
    NEW.created_at := now();
    NEW.updated_at := now();
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.local_date IS DISTINCT FROM OLD.local_date
    THEN
      RAISE EXCEPTION 'Stress estimate ownership cannot be changed';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_stress_estimate_owner()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_stress_estimate_owner()
  TO authenticated;

CREATE TABLE IF NOT EXISTS public.user_stress_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  level text NOT NULL CHECK (level IN ('calm', 'mild', 'elevated', 'high')),
  confidence text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  components jsonb NOT NULL DEFAULT '{}'::jsonb,
  journal_sentiment integer CHECK (journal_sentiment BETWEEN 0 AND 100),
  algorithm_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_stress_estimates_user_date_key UNIQUE (user_id, local_date)
);

DROP TRIGGER IF EXISTS user_stress_estimates_enforce_owner
  ON public.user_stress_estimates;
CREATE TRIGGER user_stress_estimates_enforce_owner
BEFORE INSERT OR UPDATE ON public.user_stress_estimates
FOR EACH ROW EXECUTE FUNCTION public.enforce_stress_estimate_owner();

ALTER TABLE public.user_stress_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stress_estimates FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_stress_estimates FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_stress_estimates TO authenticated;
GRANT ALL ON TABLE public.user_stress_estimates TO service_role;

DROP POLICY IF EXISTS user_stress_estimates_select_own ON public.user_stress_estimates;
CREATE POLICY user_stress_estimates_select_own
  ON public.user_stress_estimates FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_stress_estimates_insert_own ON public.user_stress_estimates;
CREATE POLICY user_stress_estimates_insert_own
  ON public.user_stress_estimates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_stress_estimates_update_own ON public.user_stress_estimates;
CREATE POLICY user_stress_estimates_update_own
  ON public.user_stress_estimates FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_stress_estimates_delete_own ON public.user_stress_estimates;
CREATE POLICY user_stress_estimates_delete_own
  ON public.user_stress_estimates FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
