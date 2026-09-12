-- Migration: ai_content_reports
-- Run manually in the Supabase SQL Editor.
-- Do not run automatically against production.
--
-- Stores only the individual assistant response selected by the user, its
-- category, an optional note, launch language, review status, user ownership,
-- report client ID, and server-generated timestamp. It never stores tokens,
-- keys, user messages, conversation history, journal data, or profile metadata.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_content_reports (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  report_client_id   UUID        NOT NULL,
  coach_response_id  UUID        NOT NULL,
  category           TEXT        NOT NULL CHECK (
    category IN (
      'harmful_or_unsafe',
      'offensive_or_discriminatory',
      'incorrect_or_misleading',
      'other'
    )
  ),
  assistant_response TEXT        NOT NULL CHECK (char_length(assistant_response) BETWEEN 1 AND 4000),
  optional_note      TEXT        CHECK (optional_note IS NULL OR char_length(optional_note) <= 500),
  language           TEXT        NOT NULL CHECK (language IN ('en', 'id', 'ja')),
  review_status      TEXT        NOT NULL DEFAULT 'pending' CHECK (
    review_status IN ('pending', 'reviewed', 'dismissed', 'actioned')
  ),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_content_reports_user_client_unique UNIQUE (user_id, report_client_id),
  CONSTRAINT ai_content_reports_user_response_unique UNIQUE (user_id, coach_response_id)
);

CREATE INDEX IF NOT EXISTS ai_content_reports_user_created_idx
  ON public.ai_content_reports (user_id, created_at);

ALTER TABLE public.ai_content_reports ENABLE ROW LEVEL SECURITY;

-- Reports are created only through the authenticated backend service-role
-- endpoint. No browser role can read or mutate report content.
REVOKE ALL ON TABLE public.ai_content_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ai_content_reports TO service_role;

-- This service-role-only function makes the duplicate check, daily quota, and
-- insert a single transaction. The user ID always comes from the API's verified
-- JWT; it is not exposed to browser roles.
CREATE OR REPLACE FUNCTION public.submit_ai_content_report(
  p_user_id UUID,
  p_report_client_id UUID,
  p_coach_response_id UUID,
  p_category TEXT,
  p_assistant_response TEXT,
  p_optional_note TEXT,
  p_language TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  daily_count INTEGER;
BEGIN
  -- Serialise report creation per user so concurrent requests cannot bypass the cap.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  IF EXISTS (
    SELECT 1 FROM public.ai_content_reports
    WHERE user_id = p_user_id
      AND (report_client_id = p_report_client_id OR coach_response_id = p_coach_response_id)
  ) THEN
    RETURN 'duplicate';
  END IF;

  SELECT pg_catalog.count(*)::pg_catalog.int4
  INTO daily_count
  FROM public.ai_content_reports
  WHERE user_id = p_user_id
    AND created_at >= (
      pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE 'UTC')
      AT TIME ZONE 'UTC'
    );

  IF daily_count >= 10 THEN
    RETURN 'daily_limit';
  END IF;

  INSERT INTO public.ai_content_reports (
    user_id,
    report_client_id,
    coach_response_id,
    category,
    assistant_response,
    optional_note,
    language
  ) VALUES (
    p_user_id,
    p_report_client_id,
    p_coach_response_id,
    p_category,
    p_assistant_response,
    p_optional_note,
    p_language
  );

  RETURN 'accepted';
END;
$$;

REVOKE ALL ON FUNCTION public.submit_ai_content_report(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ai_content_report(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- Fail closed if the security properties above are not present before this
-- migration commits. These checks intentionally run inside the same transaction.
DO $verification$
DECLARE
  report_table_oid pg_catalog.oid;
  report_function_oid pg_catalog.oid;
  table_rls_enabled boolean;
  function_count pg_catalog.int4;
  function_is_security_definer boolean;
  function_config text[];
  table_owner_oid pg_catalog.oid;
  function_owner_oid pg_catalog.oid;
  unique_client_count pg_catalog.int4;
  unique_response_count pg_catalog.int4;
BEGIN
  SELECT c.oid, c.relrowsecurity, c.relowner
  INTO report_table_oid, table_rls_enabled, table_owner_oid
  FROM pg_catalog.pg_class AS c
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'ai_content_reports'
    AND c.relkind = 'r';

  IF report_table_oid IS NULL OR NOT table_rls_enabled THEN
    RAISE EXCEPTION 'ai_content_reports table is missing or RLS is not enabled';
  END IF;

  SELECT pg_catalog.count(*)::pg_catalog.int4
  INTO function_count
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'submit_ai_content_report';

  IF function_count <> 1 THEN
    RAISE EXCEPTION 'submit_ai_content_report does not have exactly one expected signature';
  END IF;

  SELECT pg_catalog.to_regprocedure(
    'public.submit_ai_content_report(uuid,uuid,uuid,text,text,text,text)'
  )
  INTO report_function_oid;

  IF report_function_oid IS NULL THEN
    RAISE EXCEPTION 'expected submit_ai_content_report signature does not exist';
  END IF;

  SELECT p.oid, p.prosecdef, p.proconfig, p.proowner
  INTO report_function_oid, function_is_security_definer, function_config, function_owner_oid
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = report_function_oid;

  IF NOT function_is_security_definer THEN
    RAISE EXCEPTION 'submit_ai_content_report is not SECURITY DEFINER';
  END IF;

  IF function_config IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.unnest(function_config) AS config(setting)
       WHERE pg_catalog.replace(config.setting, '"', '') = 'search_path='
     ) THEN
    RAISE EXCEPTION 'submit_ai_content_report does not have an empty search_path';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (
          SELECT p.proacl
          FROM pg_catalog.pg_proc AS p
          WHERE p.oid = report_function_oid
        ),
        pg_catalog.acldefault(
          'f',
          function_owner_oid
        )
      )
    ) AS acl
    LEFT JOIN pg_catalog.pg_roles AS r ON r.oid = acl.grantee
    WHERE acl.privilege_type = 'EXECUTE'
      AND acl.grantee <> function_owner_oid
      AND (acl.grantee = 0 OR r.rolname IS DISTINCT FROM 'service_role')
  ) THEN
    RAISE EXCEPTION 'a role other than service_role can EXECUTE submit_ai_content_report';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (
          SELECT p.proacl
          FROM pg_catalog.pg_proc AS p
          WHERE p.oid = report_function_oid
        ),
        pg_catalog.acldefault(
          'f',
          function_owner_oid
        )
      )
    ) AS acl
    JOIN pg_catalog.pg_roles AS r ON r.oid = acl.grantee
    WHERE r.rolname = 'service_role'
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role does not have EXECUTE on submit_ai_content_report';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (
          SELECT c.relacl
          FROM pg_catalog.pg_class AS c
          WHERE c.oid = report_table_oid
        ),
        pg_catalog.acldefault(
          'r',
          table_owner_oid
        )
      )
    ) AS acl
    LEFT JOIN pg_catalog.pg_roles AS r ON r.oid = acl.grantee
    WHERE acl.grantee = 0
       OR r.rolname IN ('anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION 'PUBLIC, anon, or authenticated have direct table access';
  END IF;

  SELECT pg_catalog.count(*)::pg_catalog.int4
  INTO unique_client_count
  FROM pg_catalog.pg_constraint AS con
  WHERE con.conrelid = report_table_oid
    AND con.contype = 'u'
    AND con.conname = 'ai_content_reports_user_client_unique'
    AND pg_catalog.pg_get_constraintdef(con.oid) =
      'UNIQUE (user_id, report_client_id)';

  SELECT pg_catalog.count(*)::pg_catalog.int4
  INTO unique_response_count
  FROM pg_catalog.pg_constraint AS con
  WHERE con.conrelid = report_table_oid
    AND con.contype = 'u'
    AND con.conname = 'ai_content_reports_user_response_unique'
    AND pg_catalog.pg_get_constraintdef(con.oid) =
      'UNIQUE (user_id, coach_response_id)';

  IF unique_client_count <> 1 OR unique_response_count <> 1 THEN
    RAISE EXCEPTION 'required ai_content_reports unique constraints are missing';
  END IF;
END;
$verification$;

ROLLBACK;