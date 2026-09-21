import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDailyPlanSnapshot } from "./dailyPlan";

const maybeSingle = vi.fn();
const insertMaybeSingle = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const insert = vi.fn();
const from = vi.fn();

vi.mock("../supabase", () => ({
  default: {
    from: (...args: unknown[]) => from(...args),
  },
}));

import { ensureDailyPlan, loadOrCreateDailyPlan, planLocalDate } from "./dailyPlans";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function chainSelect(result: unknown) {
  maybeSingle.mockResolvedValue(result);
  eq.mockReturnValue({ eq, maybeSingle, single: maybeSingle });
  select.mockReturnValue({ eq });
}

describe("ensureDailyPlan", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    insertMaybeSingle.mockReset();
    eq.mockReset();
    select.mockReset();
    insert.mockReset();
    from.mockReset();
    from.mockImplementation(() => ({
      select,
      insert: (...args: unknown[]) => {
        insert(...args);
        return { select: () => ({ maybeSingle: insertMaybeSingle }) };
      },
    }));
  });

  it("returns the existing snapshot for the same user and local date", async () => {
    const stored = {
      id: "plan-1",
      user_id: USER_ID,
      local_date: "2026-09-19",
      primary_goal: "stress",
      plan_version: 1,
      items: [{ item_key: "mood_checkin" }],
      lesson_id: "original-lesson",
    };
    chainSelect({ data: stored, error: null });

    const draft = buildDailyPlanSnapshot({
      localDate: "2026-09-19",
      primaryGoal: "habit",
      preferredDurationMinutes: 15,
      selectedLessonId: "changed-lesson",
      enrollment: null,
    });

    const first = await ensureDailyPlan(USER_ID, draft);
    const second = await ensureDailyPlan(USER_ID, draft);
    expect(first).toEqual(stored);
    expect(second).toEqual(stored);
    expect(insert).not.toHaveBeenCalled();
    expect(first.lesson_id).toBe("original-lesson");
    expect(first.primary_goal).toBe("stress");
  });

  it("does not overwrite today's snapshot when preferences change", async () => {
    const stored = {
      id: "plan-1",
      user_id: USER_ID,
      local_date: "2026-09-19",
      primary_goal: "stress",
      plan_version: 1,
      items: [],
      lesson_id: "a",
    };
    chainSelect({ data: stored, error: null });

    const changed = buildDailyPlanSnapshot({
      localDate: "2026-09-19",
      primaryGoal: "sleep",
      preferredDurationMinutes: 3,
      selectedLessonId: "b",
      enrollment: null,
    });
    const result = await ensureDailyPlan(USER_ID, changed);
    expect(result).toEqual(stored);
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts a draft without a client-provided user_id", async () => {
    chainSelect({ data: null, error: null });
    const draft = buildDailyPlanSnapshot({
      localDate: "2026-09-19",
      primaryGoal: "focus",
      preferredDurationMinutes: 5,
      selectedLessonId: "local-1",
      enrollment: null,
    });
    insertMaybeSingle.mockResolvedValue({
      data: { id: "new-plan", user_id: USER_ID, ...draft },
      error: null,
    });

    const created = await ensureDailyPlan(USER_ID, draft);
    expect(insert).toHaveBeenCalledTimes(1);
    const payload = insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty("user_id");
    expect(payload.local_date).toBe("2026-09-19");
    expect(created.id).toBe("new-plan");
  });
});

describe("loadOrCreateDailyPlan", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    insertMaybeSingle.mockReset();
    eq.mockReset();
    select.mockReset();
    insert.mockReset();
    from.mockReset();
    from.mockImplementation(() => ({
      select,
      insert: (...args: unknown[]) => {
        insert(...args);
        return { select: () => ({ maybeSingle: insertMaybeSingle }) };
      },
    }));
  });

  it("reuses an existing snapshot and does not insert again on retry", async () => {
    const stored = {
      id: "plan-1",
      user_id: USER_ID,
      local_date: "2026-09-19",
      items: [{ item_key: "mood_checkin" }],
      lesson_id: "local-proc-7",
    };
    chainSelect({ data: stored, error: null });
    const first = await loadOrCreateDailyPlan({
      userId: USER_ID,
      localDate: "2026-09-19",
      primaryGoal: "stress",
      preferredDurationMinutes: 5,
      selectedLessonId: "changed",
      enrollment: {
        id: "enroll-1",
        program_slug: "calm-reset",
        current_day: 1,
        status: "active",
      },
    });
    const retry = await loadOrCreateDailyPlan({
      userId: USER_ID,
      localDate: "2026-09-19",
      primaryGoal: "sleep",
      preferredDurationMinutes: 15,
      selectedLessonId: "other",
      enrollment: {
        id: "enroll-1",
        program_slug: "calm-reset",
        current_day: 1,
        status: "active",
      },
    });
    expect(first).toEqual(stored);
    expect(retry).toEqual(stored);
    expect(insert).not.toHaveBeenCalled();
  });

  it("uses the saved timezone date rather than the UTC calendar date", () => {
    const jakarta = planLocalDate("Asia/Jakarta", new Date("2026-01-14T17:00:00.000Z"));
    const utc = planLocalDate("UTC", new Date("2026-01-14T17:00:00.000Z"));
    expect(jakarta).toBe("2026-01-15");
    expect(utc).toBe("2026-01-14");
  });
});

describe("markDailyPlanCompleted", () => {
  it("updates only completed_at", () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "dailyPlans.ts"),
      "utf8",
    );
    const body = source.slice(
      source.indexOf("export async function markDailyPlanCompleted"),
    );
    expect(body).toContain("update({ completed_at: completedAt })");
    expect(body).not.toContain("items:");
    expect(body).not.toContain("lesson_id:");
    expect(body).not.toContain("program_slug:");
  });
});

describe("listDailyPlansInRange", () => {
  it("is a user-scoped read of a local-date range", () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "dailyPlans.ts"),
      "utf8",
    );
    const body = source.slice(
      source.indexOf("export async function listDailyPlansInRange"),
      source.indexOf("export async function getDailyPlanForDate"),
    );
    expect(body).toContain('.from("user_daily_plans")');
    expect(body).toContain('.eq("user_id", userId)');
    expect(body).toContain(".gte(");
    expect(body).toContain(".lte(");
    expect(body).not.toContain(".insert(");
    expect(body).not.toContain(".update(");
  });
});
