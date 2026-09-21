-- Read-only inspection for wellness Daily Plan tables.
-- Safe to run in Supabase SQL Editor after wellness_daily_plan.sql.
-- Does not ALTER, INSERT, UPDATE, DELETE, GRANT, CREATE, DROP, or TRUNCATE.

SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'user_wellness_preferences',
    'user_program_enrollments',
    'user_daily_plans',
    'user_daily_activity'
  )
ORDER BY c.table_name, c.ordinal_position;

SELECT
  t.relname AS table_name,
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint AS con
JOIN pg_class AS t ON t.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN (
    'user_wellness_preferences',
    'user_program_enrollments',
    'user_daily_plans',
    'user_daily_activity'
  )
ORDER BY t.relname, con.contype, con.conname;

SELECT
  t.relname AS table_name,
  i.relname AS index_name,
  pg_get_indexdef(ix.indexrelid) AS index_def,
  ix.indisunique,
  pg_get_expr(ix.indpred, ix.indrelid) AS predicate
FROM pg_index AS ix
JOIN pg_class AS t ON t.oid = ix.indrelid
JOIN pg_class AS i ON i.oid = ix.indexrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN (
    'user_wellness_preferences',
    'user_program_enrollments',
    'user_daily_plans',
    'user_daily_activity'
  )
ORDER BY t.relname, i.relname;

SELECT
  c.relname AS table_name,
  c.relrowsecurity,
  c.relforcerowsecurity
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'user_wellness_preferences',
    'user_program_enrollments',
    'user_daily_plans',
    'user_daily_activity'
  )
ORDER BY c.relname;

SELECT
  t.relname AS table_name,
  pol.polname,
  pol.polcmd,
  pol.polroles::regrole[] AS roles,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM pg_policy AS pol
JOIN pg_class AS t ON t.oid = pol.polrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN (
    'user_wellness_preferences',
    'user_program_enrollments',
    'user_daily_plans',
    'user_daily_activity'
  )
ORDER BY t.relname, pol.polname;

SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'user_wellness_preferences',
    'user_program_enrollments',
    'user_daily_plans',
    'user_daily_activity'
  )
ORDER BY table_name, grantee, privilege_type;

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'enforce_wellness_owner_and_timestamp',
    'enforce_wellness_daily_plan_integrity',
    'enforce_wellness_activity_owner_and_timestamp',
    'complete_wellness_daily_plan',
    'abandon_wellness_program',
    'enroll_wellness_program'
  )
ORDER BY p.proname;

SELECT
  r.routine_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  p.proconfig AS config
FROM information_schema.routines AS r
JOIN pg_proc AS p
  ON p.proname = r.routine_name
JOIN pg_namespace AS n
  ON n.oid = p.pronamespace
 AND n.nspname = r.specific_schema
WHERE r.specific_schema = 'public'
  AND r.routine_name IN (
    'complete_wellness_daily_plan',
    'abandon_wellness_program',
    'enroll_wellness_program'
  )
ORDER BY r.routine_name;

SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'complete_wellness_daily_plan',
    'abandon_wellness_program',
    'enroll_wellness_program'
  )
ORDER BY routine_name, grantee, privilege_type;

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_userbyid(p.proowner) AS owner_role,
  owner.rolsuper AS owner_rolsuper,
  owner.rolbypassrls AS owner_rolbypassrls,
  p.prosecdef AS security_definer,
  p.proconfig AS config
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
JOIN pg_roles AS owner ON owner.oid = p.proowner
WHERE n.nspname = 'public'
  AND p.proname IN (
    'enroll_wellness_program',
    'complete_wellness_daily_plan',
    'abandon_wellness_program'
  )
ORDER BY p.proname;

SELECT
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN (
        'user_wellness_preferences',
        'user_program_enrollments',
        'user_daily_plans',
        'user_daily_activity'
      )
      AND grantee = 'authenticated'
      AND privilege_type = 'DELE' || 'TE'
  ) AS authenticated_has_no_delete,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.column_privileges
    WHERE table_schema = 'public'
      AND table_name = 'user_daily_plans'
      AND column_name = 'completed_at'
      AND grantee = 'authenticated'
      AND privilege_type = 'UPD' || 'ATE'
  ) AS authenticated_cannot_update_plan_completed_at,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.column_privileges
    WHERE table_schema = 'public'
      AND table_name = 'user_program_enrollments'
      AND column_name IN ('current_day', 'status', 'completed_on')
      AND grantee = 'authenticated'
      AND privilege_type = 'UPD' || 'ATE'
  ) AS authenticated_cannot_update_enrollment_progress,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('user_program_enrollments', 'user_daily_plans')
      AND grantee = 'authenticated'
      AND privilege_type = 'UPD' || 'ATE'
  ) AS authenticated_has_no_direct_plan_or_enrollment_update,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'user_program_enrollments'
      AND grantee = 'authenticated'
      AND privilege_type = 'INS' || 'ERT'
  ) AS authenticated_cannot_insert_enrollment,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'user_program_enrollments'
      AND grantee = 'authenticated'
      AND privilege_type <> 'SELECT'
  ) AS authenticated_enrollment_select_only;

SELECT
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name
FROM pg_trigger AS t
JOIN pg_class AS c ON c.oid = t.tgrelid
JOIN pg_proc AS p ON p.oid = t.tgfoid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND c.relname IN (
    'user_wellness_preferences',
    'user_program_enrollments',
    'user_daily_plans',
    'user_daily_activity'
  )
ORDER BY c.relname, t.tgname;

SELECT
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_wellness_preferences'
  ) AS preferences_present,
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_program_enrollments'
  ) AS enrollments_present,
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_daily_plans'
  ) AS daily_plans_present,
  EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_daily_activity'
  ) AS daily_activity_present,
  EXISTS (
    SELECT 1 FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_program_enrollments'
      AND ix.indisunique
      AND pg_get_expr(ix.indpred, ix.indrelid) IS NOT NULL
  ) AS one_active_enrollment_index_present,
  EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_program_enrollments'
      AND con.conname = 'user_program_enrollments_id_user_key'
      AND con.contype = 'u'
  ) AS enrollment_id_user_unique_present,
  EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_daily_plans'
      AND con.conname = 'user_daily_plans_id_user_date_key'
      AND con.contype = 'u'
  ) AS plan_id_user_date_unique_present,
  EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_daily_plans'
      AND con.conname = 'user_daily_plans_enrollment_owner_fkey'
      AND con.contype = 'f'
      AND con.confdeltype = 'r'
  ) AS enrollment_owner_fk_restrict_present,
  EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class t ON t.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_daily_activity'
      AND con.conname = 'user_daily_activity_plan_owner_date_fkey'
      AND con.contype = 'f'
      AND con.confdeltype = 'c'
  ) AS activity_plan_fk_cascade_present;

SELECT
  p.proname,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'enforce_wellness_owner_and_timestamp',
    'enforce_wellness_daily_plan_integrity',
    'enforce_wellness_activity_owner_and_timestamp',
    'complete_wellness_daily_plan',
    'abandon_wellness_program',
    'enroll_wellness_program'
  )
ORDER BY p.proname;

SELECT
  table_name,
  column_name,
  grantee,
  privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN (
    'user_wellness_preferences',
    'user_program_enrollments',
    'user_daily_plans',
    'user_daily_activity'
  )
  AND grantee = 'authenticated'
ORDER BY table_name, column_name, privilege_type;
