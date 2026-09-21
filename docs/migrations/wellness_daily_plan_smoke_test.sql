-- Review-only smoke test for live wellness RPCs.
-- Do not run from application startup.
--
-- Replace every <AUTH_USER_UUID> with the UUID of an existing test account
-- that currently has no active wellness enrollment.
--
-- Always ends with ROLLBACK so inserted rows do not persist.
-- If any statement fails before the final ROLLBACK, run ROLLBACK
-- manually in the SQL editor so the open transaction does not linger.

BEGIN;

-- Transaction-local JWT claims for auth.uid(). No keys, URLs, or tokens.
SELECT set_config('request.jwt.claim.sub', '<AUTH_USER_UUID>', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '<AUTH_USER_UUID>',
    'role', 'authenticated'
  )::text,
  true
);

SET LOCAL ROLE authenticated;

-- ---------------------------------------------------------------------------
-- 1. Enrollment creation
-- ---------------------------------------------------------------------------
SELECT
  set_config('wellness.smoke_enroll_id', r.enrollment_id::text, true) AS stored_enroll_id,
  set_config('wellness.smoke_already_active', r.already_active::text, true) AS stored_already_active,
  r.enrollment_id,
  r.program_slug,
  r.status,
  r.current_day,
  r.started_on,
  r.already_active
FROM public.enroll_wellness_program('calm-reset') AS r;

SELECT *
FROM public.user_program_enrollments
WHERE id = current_setting('wellness.smoke_enroll_id')::uuid;

DO $assert$
DECLARE
  e public.user_program_enrollments%ROWTYPE;
BEGIN
  IF current_setting('wellness.smoke_already_active') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'enroll: expected already_active false on first create';
  END IF;
  SELECT *
    INTO STRICT e
    FROM public.user_program_enrollments
   WHERE id = current_setting('wellness.smoke_enroll_id')::uuid
     AND user_id = auth.uid();
  IF e.program_slug IS DISTINCT FROM 'calm-reset' THEN
    RAISE EXCEPTION 'enroll: expected program_slug calm-reset';
  END IF;
  IF e.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'enroll: expected status active';
  END IF;
  IF e.current_day IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'enroll: expected current_day 1';
  END IF;
  IF e.completed_on IS NOT NULL THEN
    RAISE EXCEPTION 'enroll: expected completed_on null';
  END IF;
  IF e.started_on IS NULL THEN
    RAISE EXCEPTION 'enroll: expected server started_on';
  END IF;
END
$assert$;

-- ---------------------------------------------------------------------------
-- 2. Idempotent re-enroll of the same slug
-- ---------------------------------------------------------------------------
SELECT
  set_config('wellness.smoke_re_enroll_id', r.enrollment_id::text, true) AS stored_enroll_id,
  set_config('wellness.smoke_already_active', r.already_active::text, true) AS stored_already_active,
  set_config('wellness.smoke_re_current_day', r.current_day::text, true) AS stored_current_day,
  set_config('wellness.smoke_re_status', r.status, true) AS stored_status,
  set_config('wellness.smoke_re_slug', r.program_slug, true) AS stored_program_slug,
  r.enrollment_id,
  r.program_slug,
  r.status,
  r.current_day,
  r.already_active
FROM public.enroll_wellness_program('calm-reset') AS r;

DO $assert$
BEGIN
  IF current_setting('wellness.smoke_already_active') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'enroll: expected already_active true on second call';
  END IF;
  IF current_setting('wellness.smoke_re_enroll_id') IS DISTINCT FROM current_setting('wellness.smoke_enroll_id') THEN
    RAISE EXCEPTION 'enroll: expected the same enrollment_id';
  END IF;
  IF current_setting('wellness.smoke_re_current_day') IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'enroll: idempotent call must not change current_day';
  END IF;
  IF current_setting('wellness.smoke_re_status') IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'enroll: idempotent call must remain active';
  END IF;
  IF current_setting('wellness.smoke_re_slug') IS DISTINCT FROM 'calm-reset' THEN
    RAISE EXCEPTION 'enroll: expected program_slug calm-reset';
  END IF;
END
$assert$;

-- ---------------------------------------------------------------------------
-- 3. Temporary Daily Plan + matching activity
-- ---------------------------------------------------------------------------
INSERT INTO public.user_daily_plans (
  local_date,
  enrollment_id,
  program_slug,
  program_day,
  primary_goal,
  plan_version,
  lesson_id,
  items
)
VALUES (
  DATE '2099-12-31',
  current_setting('wellness.smoke_enroll_id')::uuid,
  'calm-reset',
  1,
  'stress',
  1,
  NULL,
  jsonb_build_array(
    jsonb_build_object(
      'item_key', 'program_practice',
      'item_type', 'program_practice',
      'required', true,
      'planned_minutes', 5,
      'practice_kind', 'breathing',
      'practice_content_key', 'programs.practice.breathing'
    )
  )
);

SELECT
  set_config('wellness.smoke_plan_id', p.id::text, true) AS stored_plan_id,
  p.id,
  p.local_date,
  p.enrollment_id,
  p.program_slug,
  p.program_day,
  p.completed_at,
  p.items
FROM public.user_daily_plans AS p
WHERE p.user_id = auth.uid()
  AND p.local_date = DATE '2099-12-31';

INSERT INTO public.user_daily_activity (
  daily_plan_id,
  item_key,
  item_type
)
VALUES (
  current_setting('wellness.smoke_plan_id')::uuid,
  'program_practice',
  'program_practice'
);

SELECT
  a.id,
  a.daily_plan_id,
  a.item_key,
  a.item_type,
  a.practice_kind,
  a.local_date,
  a.completed_at
FROM public.user_daily_activity AS a
WHERE a.daily_plan_id = current_setting('wellness.smoke_plan_id')::uuid;

-- ---------------------------------------------------------------------------
-- 4. First completion: advance day 1 -> 2
-- ---------------------------------------------------------------------------
SELECT
  set_config('wellness.smoke_plan_completed', r.plan_completed::text, true) AS stored_plan_completed,
  set_config('wellness.smoke_advanced', r.advanced::text, true) AS stored_advanced,
  set_config('wellness.smoke_current_day', r.current_program_day::text, true) AS stored_current_day,
  set_config('wellness.smoke_enroll_status', r.enrollment_status, true) AS stored_enroll_status,
  r.*
FROM public.complete_wellness_daily_plan(
  current_setting('wellness.smoke_plan_id')::uuid
) AS r;

SELECT
  e.id,
  e.program_slug,
  e.status,
  e.current_day,
  e.completed_on
FROM public.user_program_enrollments AS e
WHERE e.id = current_setting('wellness.smoke_enroll_id')::uuid;

DO $assert$
DECLARE
  e public.user_program_enrollments%ROWTYPE;
BEGIN
  IF current_setting('wellness.smoke_plan_completed') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'complete: expected plan_completed true';
  END IF;
  IF current_setting('wellness.smoke_advanced') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'complete: expected advanced true on first completion';
  END IF;
  IF current_setting('wellness.smoke_current_day') IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'complete: expected current_program_day 2';
  END IF;
  IF current_setting('wellness.smoke_enroll_status') IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'complete: expected enrollment to remain active';
  END IF;
  SELECT *
    INTO STRICT e
    FROM public.user_program_enrollments
   WHERE id = current_setting('wellness.smoke_enroll_id')::uuid;
  IF e.current_day IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'complete: enrollment current_day must be 2';
  END IF;
  IF e.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'complete: enrollment status must stay active';
  END IF;
END
$assert$;

-- ---------------------------------------------------------------------------
-- 5. Second completion: do not advance twice
-- ---------------------------------------------------------------------------
SELECT
  set_config('wellness.smoke_plan_completed', r.plan_completed::text, true) AS stored_plan_completed,
  set_config('wellness.smoke_advanced', r.advanced::text, true) AS stored_advanced,
  set_config('wellness.smoke_current_day', r.current_program_day::text, true) AS stored_current_day,
  set_config('wellness.smoke_enroll_status', r.enrollment_status, true) AS stored_enroll_status,
  r.*
FROM public.complete_wellness_daily_plan(
  current_setting('wellness.smoke_plan_id')::uuid
) AS r;

DO $assert$
DECLARE
  e public.user_program_enrollments%ROWTYPE;
BEGIN
  IF current_setting('wellness.smoke_plan_completed') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'complete-again: expected plan_completed true';
  END IF;
  IF current_setting('wellness.smoke_advanced') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'complete-again: expected advanced false';
  END IF;
  IF current_setting('wellness.smoke_current_day') IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'complete-again: current_program_day must stay 2';
  END IF;
  IF current_setting('wellness.smoke_enroll_status') IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'complete-again: expected enrollment to remain active';
  END IF;
  SELECT *
    INTO STRICT e
    FROM public.user_program_enrollments
   WHERE id = current_setting('wellness.smoke_enroll_id')::uuid;
  IF e.current_day IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'complete-again: enrollment current_day must stay 2';
  END IF;
END
$assert$;

-- ---------------------------------------------------------------------------
-- 6. Abandon, then idempotent abandon
-- ---------------------------------------------------------------------------
SELECT
  set_config('wellness.smoke_abandon_status', r.status, true) AS stored_abandon_status,
  set_config('wellness.smoke_already_abandoned', r.already_abandoned::text, true) AS stored_already_abandoned,
  r.*
FROM public.abandon_wellness_program(
  current_setting('wellness.smoke_enroll_id')::uuid
) AS r;

SELECT
  e.id,
  e.status,
  e.current_day,
  e.completed_on
FROM public.user_program_enrollments AS e
WHERE e.id = current_setting('wellness.smoke_enroll_id')::uuid;

DO $assert$
DECLARE
  e public.user_program_enrollments%ROWTYPE;
BEGIN
  IF current_setting('wellness.smoke_abandon_status') IS DISTINCT FROM 'abandoned' THEN
    RAISE EXCEPTION 'abandon: expected status abandoned';
  END IF;
  IF current_setting('wellness.smoke_already_abandoned') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'abandon: expected already_abandoned false on first abandon';
  END IF;
  SELECT *
    INTO STRICT e
    FROM public.user_program_enrollments
   WHERE id = current_setting('wellness.smoke_enroll_id')::uuid;
  IF e.status IS DISTINCT FROM 'abandoned' THEN
    RAISE EXCEPTION 'abandon: enrollment row must be abandoned';
  END IF;
END
$assert$;

SELECT
  set_config('wellness.smoke_abandon_status', r.status, true) AS stored_abandon_status,
  set_config('wellness.smoke_already_abandoned', r.already_abandoned::text, true) AS stored_already_abandoned,
  r.*
FROM public.abandon_wellness_program(
  current_setting('wellness.smoke_enroll_id')::uuid
) AS r;

DO $assert$
BEGIN
  IF current_setting('wellness.smoke_abandon_status') IS DISTINCT FROM 'abandoned' THEN
    RAISE EXCEPTION 'abandon-again: expected status abandoned';
  END IF;
  IF current_setting('wellness.smoke_already_abandoned') IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'abandon-again: expected already_abandoned true';
  END IF;
END
$assert$;

ROLLBACK;
