-- Migration: harden_supabase_functions
--
-- P0 hardening for the four audited Supabase functions.
--
-- IMPORTANT:
--   * This file is intentionally not executed by the application or build.
--   * coach_increment_usage() is verified only; its definition, signature,
--     privilege model, and rate-limit behavior are intentionally unchanged.
--   * get_action_ratio(uuid, date) has no application callers and is removed.
--   * postpone_task(uuid) remains SECURITY DEFINER because the audit did not
--     establish that authenticated callers have sufficient UPDATE privilege
--     under the current RLS configuration. It is hardened with an empty
--     search_path and an explicit auth.uid() ownership check.
--   * update_daily_metrics() remains SECURITY DEFINER because it recalculates
--     aggregate metrics across public.tasks from a trigger and the audit did
--     not establish that invoker privileges/RLS would permit that operation.
--
-- Run manually in the Supabase SQL Editor after reviewing the verification
-- output. This migration does not create, delete, or modify user rows.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Preconditions: fail closed if the audited signatures are not present.
-- ---------------------------------------------------------------------------
DO $preflight$
BEGIN
  IF to_regprocedure('public.postpone_task(uuid)') IS NULL THEN
    RAISE EXCEPTION
      'Expected public.postpone_task(uuid) was not found; refusing to guess its signature';
  END IF;

  IF to_regprocedure('public.update_daily_metrics()') IS NULL THEN
    RAISE EXCEPTION
      'Expected public.update_daily_metrics() was not found; refusing to guess its signature';
  END IF;

  IF to_regprocedure('public.coach_increment_usage()') IS NULL THEN
    RAISE EXCEPTION
      'Expected public.coach_increment_usage() was not found; refusing to proceed';
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. get_action_ratio(uuid, date)
--
-- This function has no application callers. Its caller-supplied user UUID,
-- SECURITY DEFINER execution, broad EXECUTE grants, and unqualified relation
-- references create an IDOR/data-disclosure risk. Remove this exact signature.
-- The conditional block keeps reruns idempotent and removes its old grants
-- before dropping it.
-- ---------------------------------------------------------------------------
DO $drop_unused_ratio$
BEGIN
  IF to_regprocedure('public.get_action_ratio(uuid, date)') IS NOT NULL THEN
    EXECUTE
      'REVOKE ALL ON FUNCTION public.get_action_ratio(uuid, date) ' ||
      'FROM PUBLIC, anon, authenticated, service_role';
    EXECUTE 'DROP FUNCTION public.get_action_ratio(uuid, date)';
  END IF;
END
$drop_unused_ratio$;

-- ---------------------------------------------------------------------------
-- 2. postpone_task(uuid)
--
-- Keep the audited return type (public.tasks) and behavior. SECURITY DEFINER
-- is retained because the available audit did not prove that SECURITY INVOKER
-- would have sufficient UPDATE privilege under the current RLS configuration.
-- The function is nevertheless safe against caller-controlled ownership:
-- identity comes only from auth.uid(), NULL sessions are rejected explicitly,
-- and the UPDATE predicate requires both task ID and owner ID.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.postpone_task(p_task_id uuid)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_task    public.tasks;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'postpone_task requires an authenticated session'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.tasks
  SET
    postpone_count = postpone_count + 1,
    original_title = CASE
      WHEN original_title IS NULL THEN title
      ELSE original_title
    END,
    updated_at = now()
  WHERE public.tasks.id = p_task_id
    AND public.tasks.user_id = v_user_id
  RETURNING public.tasks.* INTO v_task;

  RETURN v_task;
END;
$function$;

REVOKE ALL ON FUNCTION public.postpone_task(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.postpone_task(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. update_daily_metrics()
--
-- Keep SECURITY DEFINER because the trigger recalculates aggregates from
-- public.tasks and must continue to work independently of the mutating
-- caller's row visibility. Every relation is schema-qualified and the empty
-- search_path prevents search_path hijacking.
--
-- During ON DELETE CASCADE from auth.users, the deleted user is no longer
-- visible through auth.users to this transaction's trigger execution. The
-- existence guard therefore skips the upsert and prevents this trigger from
-- recreating daily_metrics for a user being deleted. Normal task INSERT,
-- UPDATE, and DELETE events for an existing user retain the previous metrics
-- calculation and trigger return behavior.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_daily_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_date    date;
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE u.id = v_user_id
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_date := current_date;

  INSERT INTO public.daily_metrics (
    user_id,
    date,
    tasks_planned,
    tasks_completed
  )
  VALUES (
    v_user_id,
    v_date,
    (
      SELECT count(*)
      FROM public.tasks AS t
      WHERE t.user_id = v_user_id
        AND t.created_at::date = v_date
    ),
    (
      SELECT count(*)
      FROM public.tasks AS t
      WHERE t.user_id = v_user_id
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

-- Trigger execution does not require a direct caller grant. Do not drop or
-- recreate on_task_change; CREATE OR REPLACE above preserves its binding.

-- ---------------------------------------------------------------------------
-- 4. coach_increment_usage()
--
-- Deliberately no ALTER/CREATE/REPLACE/GRANT/REVOKE statement targets this
-- function. The assertion below verifies the audited invariants only.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. In-transaction verification. Fail before COMMIT if any hardening
-- invariant is missing.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  v_def       text;
  v_prosecdef boolean;
  v_has_empty_search_path boolean;
  v_trigger_type integer;
  v_has_disallowed_execute boolean;
BEGIN
  -- The unused IDOR function and all overloads must be gone.
  IF EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_action_ratio'
  ) THEN
    RAISE EXCEPTION 'get_action_ratio overload still exists';
  END IF;

  SELECT
    p.prosecdef,
    EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(setting)
      WHERE replace(config.setting, '"', '') = 'search_path='
    ),
    pg_get_functiondef(p.oid)
  INTO v_prosecdef, v_has_empty_search_path, v_def
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'postpone_task'
    AND pg_get_function_identity_arguments(p.oid) = 'p_task_id uuid';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'postpone_task(uuid) verification target not found';
  END IF;
  IF NOT v_prosecdef OR NOT v_has_empty_search_path THEN
    RAISE EXCEPTION 'postpone_task(uuid) is not SECURITY DEFINER with empty search_path';
  END IF;
  IF position('public.tasks' IN v_def) = 0
     OR position('auth.uid()' IN v_def) = 0 THEN
    RAISE EXCEPTION 'postpone_task(uuid) is missing schema-qualified ownership checks';
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
    RAISE EXCEPTION 'postpone_task(uuid) is executable by a non-application role';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.postpone_task(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lacks EXECUTE on postpone_task(uuid)';
  END IF;

  SELECT
    p.prosecdef,
    EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS config(setting)
      WHERE replace(config.setting, '"', '') = 'search_path='
    ),
    pg_get_functiondef(p.oid)
  INTO v_prosecdef, v_has_empty_search_path, v_def
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'update_daily_metrics'
    AND pg_get_function_identity_arguments(p.oid) = '';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'update_daily_metrics() verification target not found';
  END IF;
  IF NOT v_prosecdef OR NOT v_has_empty_search_path THEN
    RAISE EXCEPTION 'update_daily_metrics() is not SECURITY DEFINER with empty search_path';
  END IF;
  IF position('public.tasks' IN v_def) = 0
     OR position('public.daily_metrics' IN v_def) = 0
     OR position('auth.users' IN v_def) = 0 THEN
    RAISE EXCEPTION 'update_daily_metrics() is missing schema-qualified references';
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
    RAISE EXCEPTION 'update_daily_metrics() has direct EXECUTE privilege';
  END IF;

  SELECT t.tgtype::integer
  INTO v_trigger_type
  FROM pg_trigger AS t
  JOIN pg_class AS c ON c.oid = t.tgrelid
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE t.tgname = 'on_task_change'
    AND n.nspname = 'public'
    AND c.relname = 'tasks'
    AND NOT t.tgisinternal
    AND t.tgfoid = 'public.update_daily_metrics()'::regprocedure;

  IF NOT FOUND
     -- PostgreSQL trigger type bit flags:
     -- ROW = 1, BEFORE = 2, INSERT = 4, DELETE = 8, UPDATE = 16.
     OR (v_trigger_type & 1) = 0
     OR (v_trigger_type & 2) <> 0
     OR (v_trigger_type & 4) = 0
     OR (v_trigger_type & 8) = 0
     OR (v_trigger_type & 16) = 0 THEN
    RAISE EXCEPTION 'on_task_change trigger was not preserved';
  END IF;

  -- coach_increment_usage() is read-only asserted, never modified here.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'coach_increment_usage'
      AND pg_get_function_identity_arguments(p.oid) = ''
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
    RAISE EXCEPTION 'coach_increment_usage() invariants changed';
  END IF;
END
$verify$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Read-only verification queries to run after applying this migration.
-- These queries do not read user rows.
-- ---------------------------------------------------------------------------
--
-- SELECT
--   n.nspname AS schema_name,
--   p.proname,
--   pg_get_function_identity_arguments(p.oid) AS identity_arguments,
--   pg_get_function_result(p.oid) AS return_type,
--   p.prosecdef AS security_definer,
--   p.proconfig,
--   pg_get_functiondef(p.oid) AS definition
-- FROM pg_proc AS p
-- JOIN pg_namespace AS n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'get_action_ratio',
--     'postpone_task',
--     'update_daily_metrics',
--     'coach_increment_usage'
--   )
-- ORDER BY p.proname;
--
-- SELECT
--   routine_name,
--   grantee,
--   privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'get_action_ratio',
--     'postpone_task',
--     'update_daily_metrics',
--     'coach_increment_usage'
--   )
-- ORDER BY routine_name, grantee, privilege_type;
--
-- SELECT
--   t.tgname AS trigger_name,
--   n.nspname AS table_schema,
--   c.relname AS table_name,
--   pg_get_triggerdef(t.oid) AS trigger_definition
-- FROM pg_trigger AS t
-- JOIN pg_class AS c ON c.oid = t.tgrelid
-- JOIN pg_namespace AS n ON n.oid = c.relnamespace
-- WHERE NOT t.tgisinternal
--   AND t.tgname = 'on_task_change';
--
-- SELECT
--   c.relname AS table_name,
--   c.relrowsecurity AS rls_enabled,
--   c.relforcerowsecurity AS rls_forced
-- FROM pg_class AS c
-- JOIN pg_namespace AS n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relname IN ('tasks', 'daily_metrics');
--
-- SELECT
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('tasks', 'daily_metrics')
-- ORDER BY tablename, policyname;