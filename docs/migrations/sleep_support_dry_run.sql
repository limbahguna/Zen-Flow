-- Mindful Space Sleep Support
-- Review-only migration. Do not run automatically or from application startup.
--
-- The API always derives user_id from the verified Supabase JWT. The RLS
-- policies below provide a second ownership boundary for direct database access.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sleep_check_ins (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sleep_date    DATE        NOT NULL,
  sleep_quality INTEGER     NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  energy_level  INTEGER     NOT NULL CHECK (energy_level BETWEEN 1 AND 5),
  feeling       TEXT        NOT NULL CHECK (feeling IN ('rested', 'okay', 'tired', 'restless')),
  notes         TEXT        CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sleep_check_ins_user_date_unique UNIQUE (user_id, sleep_date)
);

CREATE TABLE IF NOT EXISTS public.sleep_journal_entries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sleep_date DATE        NOT NULL,
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sleep_routine_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  sleep_date      DATE        NOT NULL,
  completed_steps TEXT[]      NOT NULL DEFAULT '{}',
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sleep_routine_sessions_user_date_unique UNIQUE (user_id, sleep_date)
);

ALTER TABLE public.sleep_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_routine_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sleep_check_ins_self_all" ON public.sleep_check_ins;
DROP POLICY IF EXISTS "sleep_journal_entries_self_all" ON public.sleep_journal_entries;
DROP POLICY IF EXISTS "sleep_routine_sessions_self_all" ON public.sleep_routine_sessions;

CREATE POLICY "sleep_check_ins_self_all"
  ON public.sleep_check_ins FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sleep_journal_entries_self_all"
  ON public.sleep_journal_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sleep_routine_sessions_self_all"
  ON public.sleep_routine_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE
  public.sleep_check_ins,
  public.sleep_journal_entries,
  public.sleep_routine_sessions
  FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.sleep_check_ins,
  public.sleep_journal_entries,
  public.sleep_routine_sessions
  TO authenticated;

CREATE INDEX IF NOT EXISTS sleep_check_ins_user_date_idx
  ON public.sleep_check_ins (user_id, sleep_date DESC);

CREATE INDEX IF NOT EXISTS sleep_journal_entries_user_date_idx
  ON public.sleep_journal_entries (user_id, sleep_date DESC);

CREATE INDEX IF NOT EXISTS sleep_routine_sessions_user_date_idx
  ON public.sleep_routine_sessions (user_id, sleep_date DESC);

ROLLBACK;