-- DESTRUCTIVE rollback for wellness Daily Plan objects.
-- Review-only. Do not run automatically or from application startup.
-- Drops only objects created by docs/migrations/wellness_daily_plan.sql.
-- Does not touch lesson_progress, micro_lessons, intentions, notifications,
-- authentication, sleep, tasks, journal, coach_usage, or user_entitlements.

BEGIN;

DROP FUNCTION IF EXISTS public.enroll_wellness_program(text);
DROP FUNCTION IF EXISTS public.complete_wellness_daily_plan(uuid);
DROP FUNCTION IF EXISTS public.abandon_wellness_program(uuid);

DROP TRIGGER IF EXISTS user_daily_activity_enforce_owner_and_timestamp
  ON public.user_daily_activity;
DROP TRIGGER IF EXISTS user_daily_plans_enforce_integrity
  ON public.user_daily_plans;
DROP TRIGGER IF EXISTS user_daily_plans_enforce_owner_and_timestamp
  ON public.user_daily_plans;
DROP TRIGGER IF EXISTS user_program_enrollments_enforce_owner_and_timestamp
  ON public.user_program_enrollments;
DROP TRIGGER IF EXISTS user_wellness_preferences_enforce_owner_and_timestamp
  ON public.user_wellness_preferences;

DROP TABLE IF EXISTS public.user_daily_activity;
DROP TABLE IF EXISTS public.user_daily_plans;
DROP TABLE IF EXISTS public.user_program_enrollments;
DROP TABLE IF EXISTS public.user_wellness_preferences;

DROP FUNCTION IF EXISTS public.enforce_wellness_activity_owner_and_timestamp();
DROP FUNCTION IF EXISTS public.enforce_wellness_daily_plan_integrity();
DROP FUNCTION IF EXISTS public.enforce_wellness_owner_and_timestamp();

COMMIT;
