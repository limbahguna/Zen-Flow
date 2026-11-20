-- Allow Arabic (ar) on wellness preferences and AI content reports.
-- Run manually in the Supabase SQL editor. Do not auto-apply from the app.

-- user_wellness_preferences.locale
ALTER TABLE public.user_wellness_preferences
  DROP CONSTRAINT IF EXISTS user_wellness_preferences_locale_check;

ALTER TABLE public.user_wellness_preferences
  ADD CONSTRAINT user_wellness_preferences_locale_check
  CHECK (locale IN ('en', 'id', 'ja', 'ar'));

-- ai_content_reports.language
ALTER TABLE public.ai_content_reports
  DROP CONSTRAINT IF EXISTS ai_content_reports_language_check;

ALTER TABLE public.ai_content_reports
  ADD CONSTRAINT ai_content_reports_language_check
  CHECK (language IN ('en', 'id', 'ja', 'ar'));
