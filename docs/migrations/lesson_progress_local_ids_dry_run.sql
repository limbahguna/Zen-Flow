-- Read-only inspection for lesson_progress. Safe to run in Supabase SQL Editor.
-- Does not ALTER, INSERT, UPDATE, DELETE, GRANT, or CREATE.

SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lesson_progress'
ORDER BY ordinal_position;

SELECT
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
WHERE con.conrelid = 'public.lesson_progress'::regclass
ORDER BY con.contype, con.conname;

SELECT
  pol.polname,
  pol.polcmd,
  pol.polroles::regrole[] AS roles,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM pg_policy pol
WHERE pol.polrelid = 'public.lesson_progress'::regclass
ORDER BY pol.polname;

SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'lesson_progress'
ORDER BY grantee, privilege_type;

SELECT relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid = 'public.lesson_progress'::regclass;

-- Post-migration checks (same predicates as lesson_progress_local_ids.sql).
-- After a successful migration expect:
--   lesson_id_is_text = true
--   lesson_id_fkey_absent = true
--   user_id_fkey_present = true
--   primary_key_present = true
--   unique_user_lesson_present = true
--   rls_enabled = true
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'lesson_progress'
      AND c.column_name = 'lesson_id'
      AND c.udt_name = 'text'
  ) AS lesson_id_is_text,
  NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS con
    WHERE con.conrelid = 'public.lesson_progress'::regclass
      AND con.conname = 'lesson_progress_lesson_id_fkey'
  ) AS lesson_id_fkey_absent,
  EXISTS (
    SELECT 1
    FROM pg_constraint AS con
    WHERE con.conrelid = 'public.lesson_progress'::regclass
      AND con.conname = 'lesson_progress_user_id_fkey'
      AND con.contype = 'f'
  ) AS user_id_fkey_present,
  EXISTS (
    SELECT 1
    FROM pg_constraint AS con
    WHERE con.conrelid = 'public.lesson_progress'::regclass
      AND con.conname = 'lesson_progress_pkey'
      AND con.contype = 'p'
  ) AS primary_key_present,
  EXISTS (
    SELECT 1
    FROM pg_constraint AS con
    WHERE con.conrelid = 'public.lesson_progress'::regclass
      AND con.conname = 'lesson_progress_user_id_lesson_id_key'
      AND con.contype = 'u'
  ) AS unique_user_lesson_present,
  (
    SELECT c.relrowsecurity
    FROM pg_class AS c
    WHERE c.oid = 'public.lesson_progress'::regclass
  ) AS rls_enabled;
