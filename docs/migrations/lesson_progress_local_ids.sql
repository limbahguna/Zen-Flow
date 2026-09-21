-- Mindful Space: lesson_progress.lesson_id as text (local + UUID ids)
-- Review-only migration. Do not run automatically or from application startup.
-- Do not execute from this repository without an explicit operator decision.
--
-- Confirmed production schema:
--   id         uuid NOT NULL DEFAULT gen_random_uuid()  PK lesson_progress_pkey
--   user_id    uuid NOT NULL  FK lesson_progress_user_id_fkey -> auth.users(id) ON DELETE CASCADE
--   lesson_id  uuid NOT NULL  FK lesson_progress_lesson_id_fkey -> micro_lessons(id) ON DELETE CASCADE
--   read_at    timestamptz NULL DEFAULT now()
--   helpful    boolean NULL
--   UNIQUE (user_id, lesson_id)  lesson_progress_user_id_lesson_id_key
--   RLS enabled (relrowsecurity = true, relforcerowsecurity = false)
--
-- This migration performs only:
--   1. Drop lesson_progress_lesson_id_fkey (required to store non-UUID bundled ids)
--   2. ALTER lesson_id TYPE text USING lesson_id::text
-- It keeps the primary key, user_id FK, existing UNIQUE, RLS policies, grants,
-- and FORCE RLS setting. It does not INSERT test rows.

BEGIN;

DO $$
DECLARE
  lesson_id_type text;
BEGIN
  IF to_regclass('public.lesson_progress') IS NULL THEN
    RAISE EXCEPTION 'public.lesson_progress does not exist';
  END IF;

  SELECT c.udt_name
  INTO lesson_id_type
  FROM information_schema.columns AS c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'lesson_progress'
    AND c.column_name = 'lesson_id';

  IF lesson_id_type IS NULL THEN
    RAISE EXCEPTION 'public.lesson_progress.lesson_id does not exist';
  END IF;

  IF lesson_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'public.lesson_progress.lesson_id has unexpected type %; expected uuid or text',
      lesson_id_type;
  END IF;

  EXECUTE 'ALTER TABLE public.lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_lesson_id_fkey';

  IF lesson_id_type = 'uuid' THEN
    EXECUTE 'ALTER TABLE public.lesson_progress ALTER COLUMN lesson_id TYPE text USING lesson_id::text';
  END IF;
END
$$;

COMMIT;

-- Post-migration verification (read-only). Expect:
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
