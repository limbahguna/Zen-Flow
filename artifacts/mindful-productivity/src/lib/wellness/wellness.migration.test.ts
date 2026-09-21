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

const TABLES = [
  "user_wellness_preferences",
  "user_program_enrollments",
  "user_daily_plans",
  "user_daily_activity",
] as const;

describe("wellness_daily_plan.sql", () => {
  const sql = readFileSync(migrationPath("wellness_daily_plan.sql"), "utf8");

  it("creates the four wellness tables with ownership, RLS, and narrowed grants", () => {
    for (const table of TABLES) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
      expect(sql).toContain(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated`);
      expect(sql).toContain(`${table}_select_own`);
      expect(sql).toContain(`${table}_insert_own`);
    }
    expect(sql).toContain("GRANT SELECT, INSERT ON TABLE public.user_wellness_preferences TO authenticated");
    expect(sql).toContain("GRANT SELECT ON TABLE public.user_program_enrollments TO authenticated");
    expect(sql).not.toContain("GRANT SELECT, INSERT ON TABLE public.user_program_enrollments TO authenticated");
    expect(sql).toContain("GRANT SELECT, INSERT ON TABLE public.user_daily_plans TO authenticated");
    expect(sql).toContain("GRANT SELECT, INSERT ON TABLE public.user_daily_activity TO authenticated");
    expect(sql).toContain("NEW.user_id := auth.uid()");
    expect(sql).toContain("Wellness row ownership cannot be changed");
    expect(sql).toContain("UNIQUE INDEX IF NOT EXISTS user_program_enrollments_one_active_idx");
    expect(sql).toContain("WHERE status = 'active'");
    expect(sql).toContain("CONSTRAINT user_program_enrollments_id_user_key UNIQUE (id, user_id)");
    expect(sql).toContain("CONSTRAINT user_daily_plans_user_local_date_key UNIQUE (user_id, local_date)");
    expect(sql).toContain("CONSTRAINT user_daily_plans_id_user_date_key UNIQUE (id, user_id, local_date)");
    expect(sql).toContain("CONSTRAINT user_daily_activity_plan_item_key UNIQUE (daily_plan_id, item_key)");
    expect(sql).toContain("CONSTRAINT user_daily_plans_enrollment_owner_fkey");
    expect(sql).toContain("FOREIGN KEY (enrollment_id, user_id)");
    expect(sql).toContain("REFERENCES public.user_program_enrollments (id, user_id)");
    expect(sql).toContain("ON DELETE RESTRICT");
    expect(sql).toContain("CONSTRAINT user_daily_activity_plan_owner_date_fkey");
    expect(sql).toContain("FOREIGN KEY (daily_plan_id, user_id, local_date)");
    expect(sql).toContain("REFERENCES public.user_daily_plans (id, user_id, local_date)");
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).toContain("jsonb_typeof(items) = 'array'");
    expect(sql).toContain("SET search_path = ''");
    expect(sql).not.toContain(
      "GRANT UPDATE (completed_at, updated_at) ON TABLE public.user_daily_plans TO authenticated",
    );
    expect(sql).not.toMatch(
      /ALTER TABLE public\.(micro_lessons|lesson_progress)|DROP TABLE public\.(micro_lessons|lesson_progress)/,
    );
  });

  it("parenthesizes CASE when comparing current_day to program duration", () => {
    const normalized = sql.replace(/\s+/g, " ");
    expect(normalized).toContain(
      "IF NEW.current_day > ( CASE NEW.program_slug WHEN 'calm-reset' THEN 7 WHEN 'better-sleep' THEN 14 WHEN 'focus-habit' THEN 21 ELSE 0 END ) THEN",
    );
    expect(normalized).not.toMatch(/IF NEW\.current_day > CASE NEW\.program_slug/);
  });
});

describe("wellness_daily_plan_dry_run.sql", () => {
  const sql = readFileSync(migrationPath("wellness_daily_plan_dry_run.sql"), "utf8");

  it("contains no mutation statements", () => {
    const withoutComments = sql.replace(/--[^\n]*/g, "");
    expect(withoutComments).toMatch(/SELECT/i);
    expect(withoutComments).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|GRANT|REVOKE|CREATE|DROP|ALTER|TRUNCATE)\b/i,
    );
  });
});

describe("wellness_daily_plan_rollback.sql", () => {
  const sql = readFileSync(migrationPath("wellness_daily_plan_rollback.sql"), "utf8");

  it("is destructive and drops only new wellness objects, children first", () => {
    expect(sql).toContain("DESTRUCTIVE");
    const activity = sql.indexOf("DROP TABLE IF EXISTS public.user_daily_activity");
    const plans = sql.indexOf("DROP TABLE IF EXISTS public.user_daily_plans");
    const enrollments = sql.indexOf("DROP TABLE IF EXISTS public.user_program_enrollments");
    const preferences = sql.indexOf("DROP TABLE IF EXISTS public.user_wellness_preferences");
    expect(activity).toBeGreaterThan(-1);
    expect(plans).toBeGreaterThan(activity);
    expect(enrollments).toBeGreaterThan(plans);
    expect(preferences).toBeGreaterThan(enrollments);
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.enroll_wellness_program(text)");
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.complete_wellness_daily_plan(uuid)");
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.abandon_wellness_program(uuid)");
    const completeRpc = sql.indexOf("DROP FUNCTION IF EXISTS public.complete_wellness_daily_plan(uuid)");
    expect(completeRpc).toBeGreaterThan(-1);
    expect(activity).toBeGreaterThan(completeRpc);
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.enforce_wellness_owner_and_timestamp()");
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.enforce_wellness_activity_owner_and_timestamp()");
    expect(sql).not.toMatch(
      /DROP TABLE IF EXISTS public\.(lesson_progress|micro_lessons|intentions|sleep_check_ins|user_entitlements|journal_entries|tasks)/,
    );
  });
});

describe("wellness_daily_plan_smoke_test.sql", () => {
  const sql = readFileSync(migrationPath("wellness_daily_plan_smoke_test.sql"), "utf8");

  it("is a transaction that always rolls back and never persists", () => {
    const beginAt = sql.search(/\bBEGIN\s*;/);
    const rollbackAt = sql.lastIndexOf("ROLLBACK;");
    expect(beginAt).toBeGreaterThan(-1);
    expect(rollbackAt).toBeGreaterThan(beginAt);
    expect(sql.trimEnd().endsWith("ROLLBACK;")).toBe(true);
    expect(sql).not.toMatch(/\bCOMMIT\b/i);
    expect(sql).toContain("<AUTH_USER_UUID>");
  });

  it("calls enroll_wellness_program exactly twice", () => {
    const calls = sql.match(/public\.enroll_wellness_program\('calm-reset'\)/g) ?? [];
    expect(calls).toHaveLength(2);
    expect(sql).toContain("public.complete_wellness_daily_plan(");
    expect(sql).toContain("public.abandon_wellness_program(");
    expect(sql).toContain("SET LOCAL ROLE authenticated");
    expect(sql).toContain("already_active");
    expect(sql).toContain("already_abandoned");
    expect(sql).toContain("DATE '2099-12-31'");
  });
});
