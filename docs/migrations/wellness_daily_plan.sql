-- Mindful Space: wellness preferences, program enrollments, Daily Plan snapshots
-- Review-only migration. Do not run automatically or from application startup.
-- Do not execute from this repository without an explicit operator decision.
--
-- Creates only:
--   public.user_wellness_preferences
--   public.user_program_enrollments
--   public.user_daily_plans
--   public.user_daily_activity
--   public.enforce_wellness_owner_and_timestamp()
--   public.enforce_wellness_daily_plan_integrity()
--   public.enforce_wellness_activity_owner_and_timestamp()
--   public.enroll_wellness_program(text)
--   public.complete_wellness_daily_plan(uuid)
--   public.abandon_wellness_program(uuid)
--
-- Does not modify micro_lessons, lesson_progress, intentions, sleep tables,
-- tasks, journal_entries, coach_usage, or user_entitlements.
--
-- Account deletion order (admin, before auth.users):
--   1. public.user_daily_activity
--   2. public.user_daily_plans
--   3. public.user_program_enrollments
--   4. public.user_wellness_preferences
-- Plans reference enrollments with ON DELETE RESTRICT so enrollments must
-- not be deleted while Daily Plan rows still point at them. Activity rows
-- cascade when their Daily Plan is deleted. Do not use ON DELETE SET NULL on
-- (enrollment_id, user_id) because user_id is NOT NULL.

BEGIN;

-- ---------------------------------------------------------------------------
-- Shared owner/timestamp trigger (preferences + enrollments)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_wellness_owner_and_timestamp()
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
    IF TG_TABLE_NAME = 'user_program_enrollments' THEN
      NEW.status := 'active';
      NEW.current_day := 1;
      NEW.completed_on := NULL;
      IF NEW.started_on IS NULL THEN
        RAISE EXCEPTION 'Enrollment started_on is required';
      END IF;
    END IF;
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Wellness row ownership cannot be changed';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;

  IF TG_TABLE_NAME = 'user_program_enrollments' THEN
    IF NEW.current_day > (
      CASE NEW.program_slug
        WHEN 'calm-reset' THEN 7
        WHEN 'better-sleep' THEN 14
        WHEN 'focus-habit' THEN 21
        ELSE 0
      END
    ) THEN
      RAISE EXCEPTION 'current_day exceeds program duration';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_wellness_owner_and_timestamp()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_wellness_owner_and_timestamp()
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Daily Plan snapshot integrity (ownership, enrollment copy, immutability)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_wellness_daily_plan_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_slug text;
  v_day smallint;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.local_date IS DISTINCT FROM OLD.local_date
      OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id
      OR NEW.program_slug IS DISTINCT FROM OLD.program_slug
      OR NEW.program_day IS DISTINCT FROM OLD.program_day
      OR NEW.primary_goal IS DISTINCT FROM OLD.primary_goal
      OR NEW.plan_version IS DISTINCT FROM OLD.plan_version
      OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
      OR NEW.items IS DISTINCT FROM OLD.items
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Daily Plan snapshot fields are immutable';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  NEW.user_id := v_uid;
  NEW.created_at := now();
  NEW.updated_at := now();
  NEW.completed_at := NULL;

  IF jsonb_typeof(NEW.items) IS DISTINCT FROM 'array'
    OR jsonb_array_length(NEW.items) < 1
    OR jsonb_array_length(NEW.items) > 4
  THEN
    RAISE EXCEPTION 'Daily Plan items must be an array of 1 to 4 objects';
  END IF;

  DECLARE
    v_elem jsonb;
    v_key text;
    v_type text;
    v_kind text;
    v_seen text[] := '{}';
    v_required_count integer := 0;
  BEGIN
    FOR v_elem IN SELECT value FROM jsonb_array_elements(NEW.items)
    LOOP
      IF jsonb_typeof(v_elem) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Daily Plan items must be objects';
      END IF;
      IF v_elem ? 'title' OR v_elem ? 'label' OR v_elem ? 'content' OR v_elem ? 'text' THEN
        RAISE EXCEPTION 'Daily Plan items cannot contain localized display text';
      END IF;
      v_key := btrim(COALESCE(v_elem->>'item_key', ''));
      IF v_key = '' THEN
        RAISE EXCEPTION 'Daily Plan item_key is required';
      END IF;
      IF v_key = ANY (v_seen) THEN
        RAISE EXCEPTION 'Daily Plan item_key values must be unique';
      END IF;
      v_seen := v_seen || v_key;
      v_type := v_elem->>'item_type';
      IF v_type IS NULL OR v_type NOT IN (
        'mood_checkin', 'daily_insight', 'program_practice', 'reflection'
      ) THEN
        RAISE EXCEPTION 'Daily Plan item_type is invalid';
      END IF;
      IF v_elem ? 'required' AND jsonb_typeof(v_elem->'required') IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Daily Plan required flag must be boolean';
      END IF;
      IF coalesce((v_elem->>'required')::boolean, true) THEN
        v_required_count := v_required_count + 1;
      END IF;
      IF v_type = 'program_practice' THEN
        v_kind := v_elem->>'practice_kind';
        IF v_kind IS NULL OR v_kind NOT IN (
          'breathing', 'relaxation', 'focus_timer', 'sleep_routine', 'movement'
        ) THEN
          RAISE EXCEPTION 'Daily Plan program_practice requires a valid practice_kind';
        END IF;
      END IF;
    END LOOP;
    IF v_required_count < 1 THEN
      RAISE EXCEPTION 'Daily Plan must include at least one required item';
    END IF;
  END;

  IF NEW.enrollment_id IS NULL THEN
    IF NEW.program_slug IS NOT NULL OR NEW.program_day IS NOT NULL THEN
      RAISE EXCEPTION 'Fallback Daily Plan cannot include program_slug or program_day';
    END IF;
    RETURN NEW;
  END IF;

  SELECT e.program_slug, e.current_day, e.status
    INTO v_slug, v_day, v_status
    FROM public.user_program_enrollments AS e
   WHERE e.id = NEW.enrollment_id
     AND e.user_id = v_uid;

  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'Enrollment not found or not owned';
  END IF;
  IF v_status = 'abandoned' THEN
    RAISE EXCEPTION 'Abandoned enrollment cannot create a Daily Plan';
  END IF;
  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'Completed enrollment cannot create a Daily Plan';
  END IF;
  IF v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Enrollment is not active';
  END IF;

  NEW.program_slug := v_slug;
  NEW.program_day := v_day;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_wellness_daily_plan_integrity()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_wellness_daily_plan_integrity()
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Activity ownership: copy user_id + local_date from the referenced plan
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_wellness_activity_owner_and_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan_user uuid;
  v_plan_date date;
  v_items jsonb;
  v_match_count integer;
  v_elem jsonb;
  v_type text;
  v_kind text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.daily_plan_id IS DISTINCT FROM OLD.daily_plan_id
      OR NEW.local_date IS DISTINCT FROM OLD.local_date
      OR NEW.item_key IS DISTINCT FROM OLD.item_key
      OR NEW.item_type IS DISTINCT FROM OLD.item_type
      OR NEW.practice_kind IS DISTINCT FROM OLD.practice_kind
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
    THEN
      RAISE EXCEPTION 'Daily activity identity fields cannot be changed';
    END IF;
    RETURN NEW;
  END IF;

  SELECT p.user_id, p.local_date, p.items
    INTO v_plan_user, v_plan_date, v_items
    FROM public.user_daily_plans AS p
   WHERE p.id = NEW.daily_plan_id
     AND p.user_id = v_uid;

  IF v_plan_user IS NULL THEN
    RAISE EXCEPTION 'Daily Plan not found or not owned';
  END IF;

  SELECT count(*)::integer
    INTO v_match_count
    FROM jsonb_array_elements(v_items) AS elem(value)
   WHERE btrim(coalesce(elem.value->>'item_key', '')) = btrim(NEW.item_key);

  IF v_match_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Activity item_key is not part of the Daily Plan';
  END IF;

  SELECT elem.value
    INTO v_elem
    FROM jsonb_array_elements(v_items) AS elem(value)
   WHERE btrim(coalesce(elem.value->>'item_key', '')) = btrim(NEW.item_key);

  v_type := v_elem->>'item_type';
  NEW.item_type := v_type;
  IF v_type = 'program_practice' THEN
    v_kind := v_elem->>'practice_kind';
    IF v_kind IS NULL OR v_kind NOT IN (
      'breathing', 'relaxation', 'focus_timer', 'sleep_routine', 'movement'
    ) THEN
      RAISE EXCEPTION 'Daily Plan program_practice requires a valid practice_kind';
    END IF;
    NEW.practice_kind := v_kind;
  ELSE
    NEW.practice_kind := NULL;
  END IF;

  NEW.user_id := v_uid;
  NEW.local_date := v_plan_date;
  NEW.created_at := now();
  NEW.completed_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_wellness_activity_owner_and_timestamp()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_wellness_activity_owner_and_timestamp()
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. user_wellness_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_wellness_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  primary_goal text NOT NULL
    CHECK (primary_goal IN ('stress', 'sleep', 'focus', 'motivation', 'self_compassion', 'habit')),
  preferred_duration_minutes smallint NOT NULL DEFAULT 5
    CHECK (preferred_duration_minutes IN (3, 5, 10, 15)),
  preferred_reminder_time time NOT NULL DEFAULT '09:00',
  timezone text NOT NULL DEFAULT 'UTC'
    CHECK (char_length(btrim(timezone)) BETWEEN 1 AND 100),
  locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'id', 'ja')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS user_wellness_preferences_enforce_owner_and_timestamp
  ON public.user_wellness_preferences;
CREATE TRIGGER user_wellness_preferences_enforce_owner_and_timestamp
BEFORE INSERT OR UPDATE ON public.user_wellness_preferences
FOR EACH ROW EXECUTE FUNCTION public.enforce_wellness_owner_and_timestamp();

ALTER TABLE public.user_wellness_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wellness_preferences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_wellness_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.user_wellness_preferences TO authenticated;
GRANT UPDATE (
  primary_goal,
  preferred_duration_minutes,
  preferred_reminder_time,
  timezone,
  locale
) ON TABLE public.user_wellness_preferences TO authenticated;

DROP POLICY IF EXISTS user_wellness_preferences_select_own ON public.user_wellness_preferences;
CREATE POLICY user_wellness_preferences_select_own
  ON public.user_wellness_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS user_wellness_preferences_insert_own ON public.user_wellness_preferences;
CREATE POLICY user_wellness_preferences_insert_own
  ON public.user_wellness_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS user_wellness_preferences_update_own ON public.user_wellness_preferences;
CREATE POLICY user_wellness_preferences_update_own
  ON public.user_wellness_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS user_wellness_preferences_delete_own ON public.user_wellness_preferences;

-- ---------------------------------------------------------------------------
-- 2. user_program_enrollments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_program_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  program_slug text NOT NULL
    CHECK (program_slug IN ('calm-reset', 'better-sleep', 'focus-habit')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  current_day smallint NOT NULL DEFAULT 1
    CHECK (current_day BETWEEN 1 AND 21),
  started_on date NOT NULL,
  completed_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_program_enrollments_id_user_key UNIQUE (id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_program_enrollments_one_active_idx
  ON public.user_program_enrollments (user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS user_program_enrollments_user_status_idx
  ON public.user_program_enrollments (user_id, status);

DROP TRIGGER IF EXISTS user_program_enrollments_enforce_owner_and_timestamp
  ON public.user_program_enrollments;
CREATE TRIGGER user_program_enrollments_enforce_owner_and_timestamp
BEFORE INSERT OR UPDATE ON public.user_program_enrollments
FOR EACH ROW EXECUTE FUNCTION public.enforce_wellness_owner_and_timestamp();

ALTER TABLE public.user_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_program_enrollments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_program_enrollments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_program_enrollments TO authenticated;

DROP POLICY IF EXISTS user_program_enrollments_select_own ON public.user_program_enrollments;
CREATE POLICY user_program_enrollments_select_own
  ON public.user_program_enrollments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS user_program_enrollments_insert_own ON public.user_program_enrollments;
DROP POLICY IF EXISTS user_program_enrollments_update_own ON public.user_program_enrollments;
DROP POLICY IF EXISTS user_program_enrollments_delete_own ON public.user_program_enrollments;

-- ---------------------------------------------------------------------------
-- 3. user_daily_plans (stable per-user local-date snapshot)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  enrollment_id uuid,
  program_slug text
    CHECK (program_slug IS NULL OR program_slug IN ('calm-reset', 'better-sleep', 'focus-habit')),
  program_day smallint
    CHECK (program_day IS NULL OR program_day BETWEEN 1 AND 21),
  primary_goal text NOT NULL
    CHECK (primary_goal IN ('stress', 'sleep', 'focus', 'motivation', 'self_compassion', 'habit')),
  plan_version smallint NOT NULL DEFAULT 1
    CHECK (plan_version >= 1),
  lesson_id text,
  items jsonb NOT NULL
    CHECK (
      jsonb_typeof(items) = 'array'
      AND jsonb_array_length(items) BETWEEN 1 AND 4
    ),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_daily_plans_user_local_date_key UNIQUE (user_id, local_date),
  CONSTRAINT user_daily_plans_id_user_date_key UNIQUE (id, user_id, local_date),
  CONSTRAINT user_daily_plans_enrollment_shape_check CHECK (
    (enrollment_id IS NULL AND program_slug IS NULL AND program_day IS NULL)
    OR (enrollment_id IS NOT NULL AND program_slug IS NOT NULL AND program_day IS NOT NULL)
  ),
  CONSTRAINT user_daily_plans_enrollment_owner_fkey
    FOREIGN KEY (enrollment_id, user_id)
    REFERENCES public.user_program_enrollments (id, user_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS user_daily_plans_user_date_idx
  ON public.user_daily_plans (user_id, local_date DESC);

DROP TRIGGER IF EXISTS user_daily_plans_enforce_owner_and_timestamp
  ON public.user_daily_plans;
DROP TRIGGER IF EXISTS user_daily_plans_enforce_integrity
  ON public.user_daily_plans;
CREATE TRIGGER user_daily_plans_enforce_integrity
BEFORE INSERT OR UPDATE ON public.user_daily_plans
FOR EACH ROW EXECUTE FUNCTION public.enforce_wellness_daily_plan_integrity();

ALTER TABLE public.user_daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_plans FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_daily_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.user_daily_plans TO authenticated;

DROP POLICY IF EXISTS user_daily_plans_select_own ON public.user_daily_plans;
CREATE POLICY user_daily_plans_select_own
  ON public.user_daily_plans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS user_daily_plans_insert_own ON public.user_daily_plans;
CREATE POLICY user_daily_plans_insert_own
  ON public.user_daily_plans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS user_daily_plans_update_own ON public.user_daily_plans;
DROP POLICY IF EXISTS user_daily_plans_delete_own ON public.user_daily_plans;

-- ---------------------------------------------------------------------------
-- 4. user_daily_activity
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_daily_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  daily_plan_id uuid NOT NULL,
  local_date date NOT NULL,
  item_key text NOT NULL,
  item_type text NOT NULL
    CHECK (item_type IN ('mood_checkin', 'daily_insight', 'program_practice', 'reflection')),
  practice_kind text
    CHECK (
      practice_kind IS NULL
      OR practice_kind IN ('breathing', 'relaxation', 'focus_timer', 'sleep_routine', 'movement')
    ),
  duration_minutes smallint
    CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 120),
  mood_score smallint
    CHECK (mood_score IS NULL OR mood_score BETWEEN 1 AND 5),
  reflection_text text
    CHECK (reflection_text IS NULL OR char_length(reflection_text) <= 2000),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_daily_activity_plan_item_key UNIQUE (daily_plan_id, item_key),
  CONSTRAINT user_daily_activity_plan_owner_date_fkey
    FOREIGN KEY (daily_plan_id, user_id, local_date)
    REFERENCES public.user_daily_plans (id, user_id, local_date)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_daily_activity_user_date_idx
  ON public.user_daily_activity (user_id, local_date DESC);

CREATE INDEX IF NOT EXISTS user_daily_activity_user_type_date_idx
  ON public.user_daily_activity (user_id, item_type, local_date DESC);

DROP TRIGGER IF EXISTS user_daily_activity_enforce_owner_and_timestamp
  ON public.user_daily_activity;
CREATE TRIGGER user_daily_activity_enforce_owner_and_timestamp
BEFORE INSERT OR UPDATE ON public.user_daily_activity
FOR EACH ROW EXECUTE FUNCTION public.enforce_wellness_activity_owner_and_timestamp();

ALTER TABLE public.user_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_activity FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_daily_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.user_daily_activity TO authenticated;
GRANT UPDATE (duration_minutes, mood_score, reflection_text)
  ON TABLE public.user_daily_activity TO authenticated;

DROP POLICY IF EXISTS user_daily_activity_select_own ON public.user_daily_activity;
CREATE POLICY user_daily_activity_select_own
  ON public.user_daily_activity FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS user_daily_activity_insert_own ON public.user_daily_activity;
CREATE POLICY user_daily_activity_insert_own
  ON public.user_daily_activity FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS user_daily_activity_update_own ON public.user_daily_activity;
CREATE POLICY user_daily_activity_update_own
  ON public.user_daily_activity FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS user_daily_activity_delete_own ON public.user_daily_activity;

-- ---------------------------------------------------------------------------
-- 5. complete_wellness_daily_plan — transactional completion + progression
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.complete_wellness_daily_plan(uuid);

CREATE OR REPLACE FUNCTION public.complete_wellness_daily_plan(p_plan_id uuid)
RETURNS TABLE (
  plan_id uuid,
  plan_completed boolean,
  enrollment_id uuid,
  program_slug text,
  completed_program_day smallint,
  current_program_day smallint,
  enrollment_status text,
  advanced boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan public.user_daily_plans%ROWTYPE;
  v_enrollment public.user_program_enrollments%ROWTYPE;
  v_required_keys text[];
  v_required_count integer := 0;
  v_done_count integer := 0;
  v_duration smallint;
  v_advanced boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Daily Plan id is required';
  END IF;

  SELECT p.*
    INTO v_plan
    FROM public.user_daily_plans AS p
   WHERE p.id = p_plan_id
     AND p.user_id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily Plan not found or not owned';
  END IF;

  SELECT coalesce(array_agg(DISTINCT btrim(elem.value->>'item_key')), '{}')
    INTO v_required_keys
    FROM jsonb_array_elements(v_plan.items) AS elem(value)
   WHERE coalesce((elem.value->>'required')::boolean, true)
     AND btrim(coalesce(elem.value->>'item_key', '')) <> '';

  v_required_count := coalesce(cardinality(v_required_keys), 0);
  IF v_required_count = 0 THEN
    RAISE EXCEPTION 'Daily Plan has no required items';
  END IF;

  SELECT count(DISTINCT a.item_key)::integer
    INTO v_done_count
    FROM public.user_daily_activity AS a
   WHERE a.daily_plan_id = v_plan.id
     AND a.user_id = v_user_id
     AND v_required_count > 0
     AND a.item_key = ANY (v_required_keys);

  IF v_plan.enrollment_id IS NOT NULL THEN
    SELECT e.*
      INTO v_enrollment
      FROM public.user_program_enrollments AS e
     WHERE e.id = v_plan.enrollment_id
       AND e.user_id = v_user_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Enrollment not found or not owned';
    END IF;
  END IF;

  -- Idempotent completed plans return existing enrollment state without advancing.
  -- Non-active enrollments still allow a first-time plan complete, but never progress.
  IF v_plan.completed_at IS NOT NULL THEN
    plan_id := v_plan.id;
    plan_completed := true;
    enrollment_id := v_plan.enrollment_id;
    program_slug := v_plan.program_slug;
    completed_program_day := v_plan.program_day;
    current_program_day := coalesce(v_enrollment.current_day, v_plan.program_day);
    enrollment_status := v_enrollment.status;
    advanced := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_required_count > 0 AND v_done_count < v_required_count THEN
    plan_id := v_plan.id;
    plan_completed := false;
    enrollment_id := v_plan.enrollment_id;
    program_slug := v_plan.program_slug;
    completed_program_day := v_plan.program_day;
    current_program_day := coalesce(v_enrollment.current_day, v_plan.program_day);
    enrollment_status := v_enrollment.status;
    advanced := false;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.user_daily_plans AS p
     SET completed_at = now()
   WHERE p.id = v_plan.id
     AND p.user_id = v_user_id
     AND p.completed_at IS NULL;

  IF v_plan.enrollment_id IS NULL THEN
    plan_id := v_plan.id;
    plan_completed := true;
    enrollment_id := NULL;
    program_slug := NULL;
    completed_program_day := NULL;
    current_program_day := NULL;
    enrollment_status := NULL;
    advanced := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_duration := CASE v_plan.program_slug
    WHEN 'calm-reset' THEN 7
    WHEN 'better-sleep' THEN 14
    WHEN 'focus-habit' THEN 21
    ELSE NULL
  END;

  IF v_enrollment.status = 'active'
    AND v_plan.program_day IS NOT NULL
    AND v_enrollment.current_day = v_plan.program_day
    AND v_duration IS NOT NULL
  THEN
    IF v_plan.program_day < v_duration THEN
      UPDATE public.user_program_enrollments AS e
         SET current_day = e.current_day + 1
       WHERE e.id = v_enrollment.id
         AND e.user_id = v_user_id
         AND e.status = 'active'
         AND e.current_day = v_plan.program_day
         AND e.current_day < v_duration;
      IF FOUND THEN
        v_advanced := true;
        v_enrollment.current_day := v_plan.program_day + 1;
      END IF;
    ELSIF v_plan.program_day = v_duration THEN
      UPDATE public.user_program_enrollments AS e
         SET status = 'completed',
             completed_on = v_plan.local_date
       WHERE e.id = v_enrollment.id
         AND e.user_id = v_user_id
         AND e.status = 'active'
         AND e.current_day = v_plan.program_day
         AND e.current_day = v_duration;
      IF FOUND THEN
        v_advanced := true;
        v_enrollment.status := 'completed';
        v_enrollment.completed_on := v_plan.local_date;
      END IF;
    END IF;
  END IF;

  plan_id := v_plan.id;
  plan_completed := true;
  enrollment_id := v_plan.enrollment_id;
  program_slug := v_plan.program_slug;
  completed_program_day := v_plan.program_day;
  current_program_day := v_enrollment.current_day;
  enrollment_status := v_enrollment.status;
  advanced := v_advanced;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_wellness_daily_plan(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_wellness_daily_plan(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. abandon_wellness_program
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.abandon_wellness_program(uuid);

CREATE OR REPLACE FUNCTION public.abandon_wellness_program(p_enrollment_id uuid)
RETURNS TABLE (
  enrollment_id uuid,
  status text,
  already_abandoned boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_enrollment public.user_program_enrollments%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment id is required';
  END IF;

  SELECT e.*
    INTO v_enrollment
    FROM public.user_program_enrollments AS e
   WHERE e.id = p_enrollment_id
     AND e.user_id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment not found or not owned';
  END IF;

  IF v_enrollment.status = 'abandoned' THEN
    enrollment_id := v_enrollment.id;
    status := v_enrollment.status;
    already_abandoned := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_enrollment.status = 'completed' THEN
    RAISE EXCEPTION 'Completed enrollment cannot be abandoned';
  END IF;

  IF v_enrollment.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only an active enrollment can be abandoned';
  END IF;

  UPDATE public.user_program_enrollments AS e
     SET status = 'abandoned'
   WHERE e.id = v_enrollment.id
     AND e.user_id = v_user_id
     AND e.status = 'active';

  enrollment_id := v_enrollment.id;
  status := 'abandoned';
  already_abandoned := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.abandon_wellness_program(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abandon_wellness_program(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. enroll_wellness_program
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.enroll_wellness_program(text);

CREATE OR REPLACE FUNCTION public.enroll_wellness_program(p_program_slug text)
RETURNS TABLE (
  enrollment_id uuid,
  program_slug text,
  status text,
  current_day smallint,
  started_on date,
  already_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_enrollment public.user_program_enrollments%ROWTYPE;
  v_tz text;
  v_started_on date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_program_slug IS NULL OR p_program_slug NOT IN (
    'calm-reset', 'better-sleep', 'focus-habit'
  ) THEN
    RAISE EXCEPTION 'Program slug is invalid';
  END IF;

  SELECT btrim(p.timezone)
    INTO v_tz
    FROM public.user_wellness_preferences AS p
   WHERE p.user_id = v_user_id;

  IF v_tz IS NULL THEN
    v_tz := 'UTC';
  ELSIF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_timezone_names AS tz
     WHERE tz.name = v_tz
  ) THEN
    RAISE EXCEPTION 'Stored timezone is invalid';
  END IF;

  v_started_on := (pg_catalog.now() AT TIME ZONE v_tz)::date;

  SELECT e.*
    INTO v_enrollment
    FROM public.user_program_enrollments AS e
   WHERE e.user_id = v_user_id
     AND e.status = 'active'
   FOR UPDATE;

  IF FOUND THEN
    IF v_enrollment.program_slug = p_program_slug THEN
      enrollment_id := v_enrollment.id;
      program_slug := v_enrollment.program_slug;
      status := v_enrollment.status;
      current_day := v_enrollment.current_day;
      started_on := v_enrollment.started_on;
      already_active := true;
      RETURN NEXT;
      RETURN;
    END IF;
    RAISE EXCEPTION 'Another program is already active';
  END IF;

  BEGIN
    INSERT INTO public.user_program_enrollments (
      program_slug,
      started_on,
      status,
      current_day,
      completed_on
    )
    VALUES (
      p_program_slug,
      v_started_on,
      'active',
      1,
      NULL
    )
    RETURNING * INTO v_enrollment;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT e.*
        INTO v_enrollment
        FROM public.user_program_enrollments AS e
       WHERE e.user_id = v_user_id
         AND e.status = 'active';
      IF FOUND AND v_enrollment.program_slug = p_program_slug THEN
        enrollment_id := v_enrollment.id;
        program_slug := v_enrollment.program_slug;
        status := v_enrollment.status;
        current_day := v_enrollment.current_day;
        started_on := v_enrollment.started_on;
        already_active := true;
        RETURN NEXT;
        RETURN;
      END IF;
      RAISE EXCEPTION 'Another program is already active';
  END;

  enrollment_id := v_enrollment.id;
  program_slug := v_enrollment.program_slug;
  status := v_enrollment.status;
  current_day := v_enrollment.current_day;
  started_on := v_enrollment.started_on;
  already_active := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_wellness_program(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_wellness_program(text)
  TO authenticated;

COMMIT;
