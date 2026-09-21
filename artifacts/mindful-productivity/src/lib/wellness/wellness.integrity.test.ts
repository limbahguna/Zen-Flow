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

describe("wellness referential integrity and ownership", () => {
  const sql = readFileSync(migrationPath("wellness_daily_plan.sql"), "utf8");

  it("rejects a Daily Plan pointing at another user’s enrollment", () => {
    expect(sql).toContain("FOREIGN KEY (enrollment_id, user_id)");
    expect(sql).toContain("REFERENCES public.user_program_enrollments (id, user_id)");
    expect(sql).toContain("AND e.user_id = v_uid");
    expect(sql).toContain("Enrollment not found or not owned");
  });

  it("rejects activity that references another user’s Daily Plan", () => {
    expect(sql).toContain("FOREIGN KEY (daily_plan_id, user_id, local_date)");
    expect(sql).toContain("REFERENCES public.user_daily_plans (id, user_id, local_date)");
    expect(sql).toContain("AND p.user_id = v_uid");
    expect(sql).toContain("Daily Plan not found or not owned");
    expect(sql).toContain("Daily Plan items must be an array of 1 to 4 objects");
    expect(sql).toContain("Daily Plan item_key values must be unique");
    expect(sql).toContain("Daily Plan items cannot contain localized display text");
    expect(sql).toContain("Daily Plan required flag must be boolean");
    expect(sql).toContain("Daily Plan must include at least one required item");
    expect(sql).toContain("Abandoned enrollment cannot create a Daily Plan");
    expect(sql).toContain("Completed enrollment cannot create a Daily Plan");
    expect(sql).toContain("Activity item_key is not part of the Daily Plan");
    expect(sql).toContain("NEW.item_type := v_type");
    expect(sql).toContain("NEW.practice_kind := v_kind");
    expect(sql).toContain("NEW.practice_kind := NULL");
  });

  it("copies activity local_date from the referenced Daily Plan", () => {
    expect(sql).toContain("NEW.local_date := v_plan_date");
    expect(sql).toContain("SELECT p.user_id, p.local_date");
  });

  it("rejects identity-field changes on activity update", () => {
    expect(sql).toContain("Daily activity identity fields cannot be changed");
    expect(sql).toContain("NEW.daily_plan_id IS DISTINCT FROM OLD.daily_plan_id");
    expect(sql).toContain("NEW.item_key IS DISTINCT FROM OLD.item_key");
    expect(sql).toContain("GRANT UPDATE (duration_minutes, mood_score, reflection_text)");
    expect(sql).toContain("NEW.completed_at IS DISTINCT FROM OLD.completed_at");
  });

  it("keeps Daily Plan snapshot fields immutable after insert", () => {
    expect(sql).toContain("Daily Plan snapshot fields are immutable");
    expect(sql).toContain("GRANT SELECT, INSERT ON TABLE public.user_daily_plans TO authenticated");
    expect(sql).toContain("REVOKE ALL ON TABLE public.user_daily_plans FROM PUBLIC, anon, authenticated");
    expect(sql).not.toContain(
      "GRANT UPDATE (completed_at, updated_at) ON TABLE public.user_daily_plans TO authenticated",
    );
  });

  it("allows a fallback plan only when enrollment program fields are null", () => {
    expect(sql).toContain("Fallback Daily Plan cannot include program_slug or program_day");
    expect(sql).toContain("CONSTRAINT user_daily_plans_enrollment_shape_check");
    expect(sql).toContain("enrollment_id IS NULL AND program_slug IS NULL AND program_day IS NULL");
  });

  it("rejects null auth.uid() in every wellness ownership trigger", () => {
    const authChecks = sql.match(/IF (?:v_uid|auth\.uid\(\)) IS NULL THEN/g) ?? [];
    expect(authChecks.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("RAISE EXCEPTION 'Authentication required'");
  });

  it("uses a fixed empty search_path; triggers stay invoker while completion RPCs are definer", () => {
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.enforce_wellness_owner_and_timestamp()");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.enforce_wellness_daily_plan_integrity()");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.enforce_wellness_activity_owner_and_timestamp()");
    const triggerStart = sql.indexOf("CREATE OR REPLACE FUNCTION public.enforce_wellness_owner_and_timestamp()");
    const rpcStart = sql.indexOf("CREATE OR REPLACE FUNCTION public.complete_wellness_daily_plan");
    const triggerChunk = sql.slice(triggerStart, rpcStart);
    expect(triggerChunk).not.toMatch(/SECURITY DEFINER/);
    expect(triggerChunk).toContain("SECURITY INVOKER");
    expect(sql.slice(rpcStart)).toContain("SECURITY DEFINER");
    expect(sql).toContain("FROM public.user_program_enrollments AS e");
    expect(sql).toContain("FROM public.user_daily_plans AS p");
  });

  it("does not use ON DELETE SET NULL on the enrollment composite foreign key", () => {
    const enrollmentFk = sql.slice(
      sql.indexOf("CONSTRAINT user_daily_plans_enrollment_owner_fkey"),
      sql.indexOf("CONSTRAINT user_daily_plans_enrollment_owner_fkey") + 400,
    );
    expect(enrollmentFk).toContain("ON DELETE RESTRICT");
    expect(enrollmentFk).not.toContain("SET NULL");
  });
});

describe("wellness dry-run inspects composite keys and grants", () => {
  const sql = readFileSync(migrationPath("wellness_daily_plan_dry_run.sql"), "utf8");

  it("verifies composite unique keys, restrict/cascade actions, and column grants", () => {
    expect(sql).toContain("user_program_enrollments_id_user_key");
    expect(sql).toContain("user_daily_plans_id_user_date_key");
    expect(sql).toContain("user_daily_plans_enrollment_owner_fkey");
    expect(sql).toContain("user_daily_activity_plan_owner_date_fkey");
    expect(sql).toContain("con.confdeltype = 'r'");
    expect(sql).toContain("con.confdeltype = 'c'");
    expect(sql).toContain("pg_get_functiondef");
    expect(sql).toContain("information_schema.column_privileges");
    expect(sql).toContain("complete_wellness_daily_plan");
    expect(sql).toContain("abandon_wellness_program");
    expect(sql).toContain("enroll_wellness_program");
    expect(sql).toContain("prosecdef");
    expect(sql).toContain("owner_rolbypassrls");
    expect(sql).toContain("authenticated_has_no_delete");
    expect(sql).toContain("authenticated_cannot_update_plan_completed_at");
    expect(sql).toContain("authenticated_cannot_update_enrollment_progress");
    expect(sql).toContain("authenticated_cannot_insert_enrollment");
    expect(sql).toContain("authenticated_enrollment_select_only");
    expect(sql).toContain("information_schema.routine_privileges");
  });
});
