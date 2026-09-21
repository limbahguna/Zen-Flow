import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function migrationPath(name: string): string {
  const candidates = [
    resolve(process.cwd(), "docs/migrations", name),
    resolve(process.cwd(), "../../docs/migrations", name),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error(`${name} not found`);
  return path;
}

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThan(-1);
  const next = sql.indexOf("CREATE OR REPLACE FUNCTION public.", start + 10);
  const end = next === -1 ? sql.length : next;
  return sql.slice(start, end);
}

describe("complete_wellness_daily_plan RPC", () => {
  const sql = readFileSync(migrationPath("wellness_daily_plan.sql"), "utf8");
  const body = functionBody(sql, "complete_wellness_daily_plan");

  it("is a SECURITY DEFINER uuid RPC with empty search_path and authenticated EXECUTE only", () => {
    expect(body).toContain("public.complete_wellness_daily_plan(p_plan_id uuid)");
    expect(body).toContain("SECURITY DEFINER");
    expect(body).toContain("SET search_path = ''");
    expect(body).toContain("v_user_id uuid := auth.uid()");
    expect(body).not.toContain("p_user_id");
    expect(body).toContain("plan_id uuid");
    expect(body).toContain("plan_completed boolean");
    expect(body).toContain("enrollment_id uuid");
    expect(body).toContain("program_slug text");
    expect(body).toContain("completed_program_day smallint");
    expect(body).toContain("current_program_day smallint");
    expect(body).toContain("enrollment_status text");
    expect(body).toContain("advanced boolean");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.complete_wellness_daily_plan(uuid)");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.complete_wellness_daily_plan(uuid)");
    expect(sql).toContain("TO authenticated");
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.complete_wellness_daily_plan\(uuid\)\s+TO service_role/,
    );
  });

  it("locks the owned plan, rejects other users, and is idempotent when already completed", () => {
    expect(body).toContain("AND p.user_id = v_user_id");
    expect(body).toContain("FOR UPDATE");
    expect(body).toContain("Daily Plan not found or not owned");
    expect(body).toContain("IF v_plan.completed_at IS NOT NULL THEN");
    expect(body).toContain("advanced := false");
  });

  it("does not complete or advance when required activities are missing", () => {
    expect(body).toContain("coalesce((elem.value->>'required')::boolean, true)");
    expect(body).toContain("IF v_required_count = 0 THEN");
    expect(body).toContain("Daily Plan has no required items");
    expect(body).toContain("IF v_required_count > 0 AND v_done_count < v_required_count THEN");
    expect(body).toContain("plan_completed := false");
    expect(body).toContain("AND p.completed_at IS NULL");
  });

  it("uses compare-and-set so duplicate and concurrent calls advance at most once", () => {
    expect(body).toContain("AND e.current_day = v_plan.program_day");
    expect(body).toContain("AND e.current_day < v_duration");
    expect(body).toContain("SET current_day = e.current_day + 1");
    expect(sql).toContain("current_day exceeds program duration");
    expect(sql).toContain("WHEN 'calm-reset' THEN 7");
    expect(body).toContain("AND p.completed_at IS NULL");
  });

  it("does not advance a stale plan whose program_day no longer matches current_day", () => {
    expect(body).toContain("AND v_enrollment.current_day = v_plan.program_day");
  });

  it("increments intermediate days once and completes on the canonical duration", () => {
    expect(body).toContain("WHEN 'calm-reset' THEN 7");
    expect(body).toContain("WHEN 'better-sleep' THEN 14");
    expect(body).toContain("WHEN 'focus-habit' THEN 21");
    expect(body).toContain("IF v_plan.program_day < v_duration THEN");
    expect(body).toContain("ELSIF v_plan.program_day = v_duration THEN");
    expect(body).toContain("SET status = 'completed'");
    expect(body).toContain("completed_on = v_plan.local_date");
  });

  it("completes a fallback plan without updating an enrollment", () => {
    expect(body).toContain("IF v_plan.enrollment_id IS NULL THEN");
    expect(body).toContain("enrollment_id := NULL");
    expect(body).toContain("advanced := false");
  });
});

describe("abandon_wellness_program RPC", () => {
  const sql = readFileSync(migrationPath("wellness_daily_plan.sql"), "utf8");
  const body = functionBody(sql, "abandon_wellness_program");

  it("abandons only an owned active enrollment and rejects completed ones", () => {
    expect(body).toContain("public.abandon_wellness_program(p_enrollment_id uuid)");
    expect(body).toContain("SECURITY DEFINER");
    expect(body).toContain("SET search_path = ''");
    expect(body).toContain("AND e.user_id = v_user_id");
    expect(body).toContain("FOR UPDATE");
    expect(body).toContain("IF v_enrollment.status = 'abandoned' THEN");
    expect(body).toContain("already_abandoned := true");
    expect(body).toContain("Completed enrollment cannot be abandoned");
    expect(body).toContain("SET status = 'abandoned'");
    expect(body).not.toContain("DELETE FROM public.user_program_enrollments");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.abandon_wellness_program(uuid)");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.abandon_wellness_program(uuid)");
  });
});

describe("enroll_wellness_program RPC", () => {
  const sql = readFileSync(migrationPath("wellness_daily_plan.sql"), "utf8");
  const body = functionBody(sql, "enroll_wellness_program");

  it("creates an active day-1 enrollment using the stored timezone", () => {
    expect(body).toContain("public.enroll_wellness_program(p_program_slug text)");
    expect(body).toContain("SECURITY DEFINER");
    expect(body).toContain("SET search_path = ''");
    expect(body).not.toContain("p_user_id");
    expect(body).toContain("enrollment_id uuid");
    expect(body).toContain("already_active boolean");
    expect(body).toContain("'calm-reset', 'better-sleep', 'focus-habit'");
    expect(body).toContain("FROM pg_catalog.pg_timezone_names AS tz");
    expect(body).toContain("Stored timezone is invalid");
    expect(body).toContain("v_tz := 'UTC'");
    expect(body).toContain("(pg_catalog.now() AT TIME ZONE v_tz)::date");
    expect(body).toContain("FOR UPDATE");
    expect(body).toContain("already_active := true");
    expect(body).toContain("Another program is already active");
    expect(body).toContain("'active'");
    expect(body).toContain("1");
    expect(body).toContain("completed_on");
    expect(body).toContain("NULL");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.enroll_wellness_program(text)");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.enroll_wellness_program(text)");
  });
});

describe("wellness direct grants after hardening", () => {
  const sql = readFileSync(migrationPath("wellness_daily_plan.sql"), "utf8");

  it("revokes prior table privileges before applying narrower grants", () => {
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.user_wellness_preferences FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.user_program_enrollments FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.user_daily_plans FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.user_daily_activity FROM PUBLIC, anon, authenticated",
    );
  });

  it("does not grant authenticated DELETE or direct plan/enrollment UPDATE", () => {
    expect(sql).not.toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.user_wellness_preferences/,
    );
    expect(sql).not.toMatch(/GRANT .*DELETE ON TABLE public\.user_/);
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.user_program_enrollments TO authenticated",
    );
    expect(sql).not.toContain(
      "GRANT SELECT, INSERT ON TABLE public.user_program_enrollments TO authenticated",
    );
    expect(sql).toContain("GRANT SELECT, INSERT ON TABLE public.user_daily_plans TO authenticated");
    expect(sql).not.toContain(
      "GRANT UPDATE (completed_at, updated_at) ON TABLE public.user_daily_plans TO authenticated",
    );
    expect(sql).toContain("DROP POLICY IF EXISTS user_daily_plans_update_own");
    expect(sql).toContain("DROP POLICY IF EXISTS user_program_enrollments_update_own");
    expect(sql).toContain("DROP POLICY IF EXISTS user_daily_plans_delete_own");
    expect(sql).toContain("DROP POLICY IF EXISTS user_program_enrollments_delete_own");
    expect(sql).toContain("DROP POLICY IF EXISTS user_daily_activity_delete_own");
    expect(sql).toContain("DROP POLICY IF EXISTS user_wellness_preferences_delete_own");
    expect(sql).toContain("GRANT UPDATE (duration_minutes, mood_score, reflection_text)");
    expect(sql).toContain("ON TABLE public.user_daily_activity TO authenticated");
  });
});
