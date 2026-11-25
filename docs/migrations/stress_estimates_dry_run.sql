-- Read-only inspection for KindEase Stress Check.
-- Safe to run in the Supabase SQL Editor after stress_estimates.sql.
-- Does not ALTER, INSERT, UPDATE, DELETE, GRANT, CREATE, DROP, or TRUNCATE.

SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND (
    c.table_name = 'user_stress_estimates'
    OR (c.table_name = 'user_wellness_preferences' AND c.column_name = 'journal_sentiment_consent')
  )
ORDER BY c.table_name, c.ordinal_position;

SELECT
  t.relname AS table_name,
  pol.polname,
  pol.polcmd
FROM pg_policy AS pol
JOIN pg_class AS t ON t.oid = pol.polrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'user_stress_estimates'
ORDER BY pol.polname;
