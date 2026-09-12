-- Migration: coach_usage  (final — p0-3-final-rate-limit-migration)
-- Run this SQL in the Supabase SQL Editor (Project → SQL Editor → New Query).
-- Safe to run on a fresh database OR one that already has an older version of
-- this migration — all DROP/REVOKE statements are idempotent.
-- NEVER stores message content — only usage counts.
--
-- Security model
-- ──────────────
-- • Limit is hardcoded inside the SQL function (v_max_daily CONSTANT := 20).
--   Callers cannot override it — the function takes NO parameters.
-- • user_id comes exclusively from auth.uid() (verified JWT claim).
--   No user_id parameter exists; callers cannot supply or forge another user's ID.
-- • Only authenticated sessions may execute the function.
-- • Direct INSERT/UPDATE/DELETE on the table is denied to every role;
--   the SECURITY DEFINER function is the sole write path.
-- • anon and PUBLIC have no access to the table or the function.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Drop every known signature of the old function so no ambiguous overloads
--    remain after this migration runs.  New signature: no parameters.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.coach_increment_usage(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.coach_increment_usage(INTEGER);
DROP FUNCTION IF EXISTS public.coach_increment_usage();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Table (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_usage (
  user_id    UUID    NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- usage_date is stored in UTC.  The DEFAULT and all function writes use
  -- (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date to be explicit.
  usage_date DATE    NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date,
  count      INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  -- PRIMARY KEY implicitly enforces UNIQUE (user_id, usage_date),
  -- which is required for the atomic INSERT … ON CONFLICT upsert.
  CONSTRAINT coach_usage_pkey PRIMARY KEY (user_id, usage_date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.coach_usage ENABLE ROW LEVEL SECURITY;

-- Drop every known old policy before recreating the single final policy.
-- Prevents duplicate-policy errors on re-run and removes any legacy rules.
DROP POLICY IF EXISTS "coach_usage_self_all"    ON public.coach_usage;
DROP POLICY IF EXISTS "coach_usage_select_own"  ON public.coach_usage;

-- The only policy: authenticated users may SELECT their own row (to display
-- remaining count in the UI).  No INSERT / UPDATE / DELETE policy exists —
-- those operations are allowed only through the SECURITY DEFINER function.
CREATE POLICY "coach_usage_select_own"
  ON public.coach_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Table privileges
--    Explicitly revoke all, then grant only SELECT to authenticated.
--    Covers both new databases and older projects that may have blanket GRANTs.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON TABLE public.coach_usage
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.coach_usage TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Atomic rate-limit function  (no parameters)
-- ─────────────────────────────────────────────────────────────────────────────
-- Security properties:
--
--   No parameters
--     The daily limit (v_max_daily) is a local CONSTANT — callers have no way
--     to alter it.  Authenticated users CAN call Supabase RPC directly, so any
--     parameter that controls the limit would be a security hole.
--
--   SECURITY DEFINER
--     Needed so the function can INSERT/UPDATE the table even though no
--     client-level write policy exists.  The sole write path is this function.
--
--   SET search_path = ''
--     Prevents search_path injection on SECURITY DEFINER functions.  Every
--     object reference in the body is fully schema-qualified.
--     PostgreSQL always adds pg_catalog implicitly, so NOW(), RAISE, etc. work.
--
--   user_id from auth.uid() only
--     auth.uid() is set by PostgREST from the verified JWT claim 'sub'.
--     It is NULL for requests with no valid session.
--
--   UTC date
--     (NOW() AT TIME ZONE 'UTC')::date pins the day boundary to midnight UTC
--     regardless of server locale.
--
--   Atomicity
--     INSERT … ON CONFLICT … DO UPDATE … WHERE count < v_max_daily is a single
--     atomic statement.  Two concurrent requests for the same user cannot both
--     succeed when only one slot remains.
--
--   Return value
--     INTEGER  — new count after increment (1 … 20) when the call is allowed
--     NULL     — when the limit was already reached; no row is written
--
--   Quota behaviour (MVP)
--     The counter is incremented BEFORE the AI provider is called.
--     A request that fails at the provider level still consumes one unit of
--     quota.  There is no refund mechanism.  This is intentional: it prevents
--     abuse via deliberate provider failures, and it is simpler to reason about.
--
CREATE OR REPLACE FUNCTION public.coach_increment_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_daily CONSTANT INTEGER := 20;   -- hardcoded; callers cannot change this
  v_user_id   UUID;
  v_count     INTEGER;
BEGIN
  -- Resolve caller identity from the JWT presented by the Supabase client.
  -- auth.uid() is in the auth schema — already qualified; works with search_path = ''.
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'coach_increment_usage requires an authenticated session'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Atomically insert today's row or increment the existing count.
  -- The WHERE clause on DO UPDATE means the UPDATE is skipped (returning NULL)
  -- when the limit has already been reached — no write occurs in that case.
  INSERT INTO public.coach_usage (user_id, usage_date, count)
  VALUES (
    v_user_id,
    (NOW() AT TIME ZONE 'UTC')::date,
    1
  )
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET count = public.coach_usage.count + 1
    WHERE public.coach_usage.count < v_max_daily
  RETURNING public.coach_usage.count INTO v_count;

  -- v_count is NULL when the WHERE clause prevented the update.
  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Function privileges
--    REVOKE from everyone first (covers anon, authenticated, and PUBLIC).
--    Then GRANT EXECUTE exclusively to authenticated.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.coach_increment_usage()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.coach_increment_usage()
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Cleanup index
--    The composite PK already handles per-user lookups efficiently.
--    This index on usage_date alone makes bulk deletes fast.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS coach_usage_date_idx
  ON public.coach_usage (usage_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Verification queries (run after applying to confirm privileges)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name = 'coach_usage'
-- ORDER BY grantee, privilege_type;
-- Expected: authenticated → SELECT only
--
-- SELECT grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_name = 'coach_increment_usage';
-- Expected: authenticated → EXECUTE only
--
-- SELECT pg_get_function_identity_arguments(p.oid), p.prosecdef
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'coach_increment_usage';
-- Expected: one row with empty args '' and prosecdef = true (SECURITY DEFINER)
-- (The old signatures with UUID,INTEGER and INTEGER should NOT appear.)

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Optional: scheduled cleanup via pg_cron
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT cron.schedule(
--   'purge-coach-usage',
--   '0 3 * * *',
--   $$DELETE FROM public.coach_usage
--     WHERE usage_date < (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '90 days'$$
-- );
