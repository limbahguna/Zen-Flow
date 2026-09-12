BEGIN;

CREATE TABLE IF NOT EXISTS public.intentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  why_it_matters text CHECK (why_it_matters IS NULL OR char_length(why_it_matters) <= 600),
  small_action text NOT NULL CHECK (char_length(btrim(small_action)) BETWEEN 1 AND 240),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'postponed', 'let_go')),
  reminder_choice text NOT NULL DEFAULT 'off' CHECK (reminder_choice IN ('off', 'morning', 'evening', 'custom')),
  reminder_time time,
  frequency text NOT NULL DEFAULT 'once' CHECK (frequency IN ('once', 'daily', 'selected_days')),
  selected_days smallint[] NOT NULL DEFAULT '{}'::smallint[]
    CHECK (selected_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  timezone text NOT NULL DEFAULT 'UTC' CHECK (char_length(timezone) BETWEEN 1 AND 100),
  postponed_until timestamptz,
  completed_at timestamptz,
  let_go_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (reminder_choice = 'off' AND reminder_time IS NULL)
    OR (reminder_choice <> 'off' AND reminder_time IS NOT NULL)
  ),
  CHECK (
    (frequency = 'selected_days' AND cardinality(selected_days) > 0)
    OR (frequency <> 'selected_days' AND cardinality(selected_days) = 0)
  )
);

CREATE INDEX IF NOT EXISTS intentions_user_status_updated_idx
  ON public.intentions (user_id, status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_intention_owner_and_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
    NEW.created_at := coalesce(NEW.created_at, now());
  ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Intention ownership cannot be changed';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_intention_owner_and_timestamp() FROM public;
DROP TRIGGER IF EXISTS intentions_enforce_owner_and_timestamp ON public.intentions;
CREATE TRIGGER intentions_enforce_owner_and_timestamp
BEFORE INSERT OR UPDATE ON public.intentions
FOR EACH ROW EXECUTE FUNCTION public.enforce_intention_owner_and_timestamp();

ALTER TABLE public.intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.intentions FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.intentions TO authenticated;

DROP POLICY IF EXISTS intentions_select_own ON public.intentions;
CREATE POLICY intentions_select_own ON public.intentions FOR SELECT TO authenticated
USING (auth.uid() = user_id);
DROP POLICY IF EXISTS intentions_insert_own ON public.intentions;
CREATE POLICY intentions_insert_own ON public.intentions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS intentions_update_own ON public.intentions;
CREATE POLICY intentions_update_own ON public.intentions FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS intentions_delete_own ON public.intentions;
CREATE POLICY intentions_delete_own ON public.intentions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

COMMIT;