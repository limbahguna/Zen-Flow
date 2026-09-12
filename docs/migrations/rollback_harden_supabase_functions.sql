-- Emergency rollback for docs/migrations/harden_supabase_functions.sql
--
-- Restores the original business behavior of:
--   * public.postpone_task(uuid)
--   * public.update_daily_metrics()
--
-- Security-preserving differences from the original production definitions:
--   * all application relations/types are schema-qualified;
--   * both functions retain SECURITY DEFINER with an empty search_path;
--   * direct EXECUTE is restricted to the required roles.
--
-- This rollback intentionally does not:
--   * restore public.get_action_ratio(uuid, date);
--   * modify public.coach_increment_usage();
--   * drop or recreate trigger public.on_task_change;
--   * remove dependent objects.
--
-- Apply manually only after reviewing the fail-closed assertions below.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Preconditions: fail closed if the expected function signatures or
-- trigger are missing. No signature or trigger definition is guessed.
-- ---------------------------------------------------------------------------
DO $preflight$
BEGIN
  IF to_regprocedure('public.postpone_task(uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Expected public.postpone_task(uuid) was not found; refusing rollback';
  END IF;

  IF to_regprocedure('public.update_daily_metrics()') IS NULL THEN
    RAISE EXCEPTION
      'Expected public.update_daily_metrics() was not found; refusing rollback';
  END IF;

  IF to_regprocedure('public.coach_increment_usage()') IS NULL THEN
    RAISE EXCEPTION
      'Expected public.coach_increment_usage() was not found; refusing rollback';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger AS t
    JOIN pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE t.tgname = 'on_task_change'
      AND n.nspname = 'public'
      AND c.relname = 'tasks'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION
      'Expected public.tasks.on_task_change trigger was not found; refusing rollback';
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. Restore original postpone_task(uuid) behavior.
--
-- The original function increments postpone_count, preserves the first
-- original_title, updates updated_at, and returns the updated owned task.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.postpone_task(p_task_id uuid)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_task public.tasks;
BEGIN
  UPDATE public.tasks
  SET
    postpone_count = postpone_count + 1,
    original_title = CASE
      WHEN original_title IS NULL THEN title
      ELSE original_title
    END,
    updated_at = now()
  WHERE public.tasks.id = p_task_id
    AND public.tasks.user_id = auth.uid()
  RETURNING public.tasks.* INTO v_task;

  RETURN v_task;
END;
$function$;

REVOKE ALL ON FUNCTION public.postpone_task(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.postpone_task(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Restore original update_daily_metrics() behavior.
--
-- The original function recalculates today's planned/completed counts after
-- task changes and returns the trigger row. The existing trigger remains
-- bound to this function; it is verified below rather than recreated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_daily_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_date date;
BEGIN
  v_date := current_date;

  INSERT INTO public.daily_metrics (
    user_id,
    date,
    tasks_planned,
    tasks_completed
  )
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    v_date,
    (
      SELECT count(*)
      FROM public.tasks AS t
      WHERE t.user_id = COALESCE(NEW.user_id, OLD.user_id)
        AND t.created_at::date = v_date
    ),
    (
      SELECT count(*)
      FROM public.tasks AS t
      WHERE t.user_id = COALESCE(NEW.user_id, OLD.user_id)
        AND t.status = 'done'
        AND t.completed_at::date = v_date
    )
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    tasks_planned = EXCLUDED.tasks_planned,
    tasks_completed = EXCLUDED.tasks_completed,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_daily_metrics()
  FROM PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Fail-closed verification.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_postpone_def text;
  v_metrics_def text;
  v_postpone_is_definer boolean;
  v_metrics_is_definer boolean;
  v_postpone_empty_search_path boolean;
  v_metrics_empty_search_path boolean;
  v_has_disallowed_execute boolean;
  v_trigger_type integer;
  v_trigger_enabled text;
BEGIN
  -- get_action_ratio was intentionally removed and must not be restored.
  IF EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_action_ratio'
  ) THEN
    RAISE EXCEPTION
      'get_action_ratio overload still exists; refusing rollback completion';
  END IF;

  SELECT
    p.prosecdef,
    EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(setting)
      WHERE replace(config.setting, '"', '') = 'search_path='
    ),
    pg_get_functiondef(p.oid)
  INTO
    v_postpone_is_definer,
    v_postpone_empty_search_path,
    v_postpone_def
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.oid = 'public.postpone_task(uuid)'::regprocedure;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'postpone_task(uuid) verification target not found';
  END IF;

  IF NOT v_postpone_is_definer
     OR NOT v_postpone_empty_search_path THEN
    RAISE EXCEPTION
      'postpone_task(uuid) is missing SECURITY DEFINER or empty search_path';
  END IF;

  IF position('public.tasks' IN v_postpone_def) = 0
     OR position('auth.uid()' IN v_postpone_def) = 0 THEN
    RAISE EXCEPTION
      'postpone_task(uuid) is missing schema-qualified ownership behavior';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) AS acl
    LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
    WHERE p.oid = 'public.postpone_task(uuid)'::regprocedure
      AND acl.privilege_type = 'EXECUTE'
      AND (
        acl.grantee = 0
        OR grantee.rolname IN ('anon', 'service_role')
      )
  )
  INTO v_has_disallowed_execute;

  IF v_has_disallowed_execute THEN
    RAISE EXCEPTION
      'postpone_task(uuid) is executable by PUBLIC, anon, or service_role';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.postpone_task(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'authenticated lacks EXECUTE on postpone_task(uuid)';
  END IF;

  SELECT
    p.prosecdef,
    EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(setting)
      WHERE replace(config.setting, '"', '') = 'search_path='
    ),
    pg_get_functiondef(p.oid)
  INTO
    v_metrics_is_definer,
    v_metrics_empty_search_path,
    v_metrics_def
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.oid = 'public.update_daily_metrics()'::regprocedure;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'update_daily_metrics() verification target not found';
  END IF;

  IF NOT v_metrics_is_definer
     OR NOT v_metrics_empty_search_path THEN
    RAISE EXCEPTION
      'update_daily_metrics() is missing SECURITY DEFINER or empty search_path';
  END IF;

  IF position('public.tasks' IN v_metrics_def) = 0
     OR position('public.daily_metrics' IN v_metrics_def) = 0 THEN
    RAISE EXCEPTION
      'update_daily_metrics() is missing schema-qualified table references';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    CROSS JOIN LATERAL aclexplode(
      COALESCE(p.proacl, acldefault('f', p.proowner))
    ) AS acl
    LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
    WHERE p.oid = 'public.update_daily_metrics()'::regprocedure
      AND acl.privilege_type = 'EXECUTE'
      AND (
        acl.grantee = 0
        OR grantee.rolname IN ('anon', 'authenticated', 'service_role')
      )
  )
  INTO v_has_disallowed_execute;

  IF v_has_disallowed_execute THEN
    RAISE EXCEPTION
      'update_daily_metrics() is directly executable by an application role';
  END IF;

  -- Confirm the existing trigger remains attached to public.tasks and calls
  -- the restored function for row-level INSERT, DELETE, and UPDATE events.
  SELECT
    t.tgtype::integer,
    t.tgenabled::text
  INTO v_trigger_type, v_trigger_enabled
  FROM pg_trigger AS t
  JOIN pg_class AS c ON c.oid = t.tgrelid
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE t.tgname = 'on_task_change'
    AND n.nspname = 'public'
    AND c.relname = 'tasks'
    AND NOT t.tgisinternal
    AND t.tgfoid = 'public.update_daily_metrics()'::regprocedure;

  IF NOT FOUND
     OR v_trigger_enabled <> 'O'
     -- PostgreSQL trigger type bit flags:
     -- ROW = 1, BEFORE = 2, INSERT = 4, DELETE = 8, UPDATE = 16.
     OR (v_trigger_type & 1) = 0
     OR (v_trigger_type & 2) <> 0
     OR (v_trigger_type & 4) = 0
     OR (v_trigger_type & 8) = 0
     OR (v_trigger_type & 16) = 0 THEN
    RAISE EXCEPTION
      'on_task_change trigger is missing, disabled, or incorrectly bound';
  END IF;

  -- coach_increment_usage() is only inspected. This rollback has no
  -- CREATE/ALTER/DROP/GRANT/REVOKE statement targeting that function.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid = 'public.coach_increment_usage()'::regprocedure
      AND p.prosecdef
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(setting)
        WHERE replace(config.setting, '"', '') = 'search_path='
      )
      AND has_function_privilege(
        'authenticated',
        'public.coach_increment_usage()',
        'EXECUTE'
      )
  ) THEN
    RAISE EXCEPTION
      'coach_increment_usage() is missing or its audited invariants changed';
  END IF;
END
$verify$;

COMMIT;
