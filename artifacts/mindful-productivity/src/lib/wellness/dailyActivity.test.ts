import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDailyPlanSnapshot } from "./dailyPlan";

const from = vi.fn();

vi.mock("../supabase", () => ({
  default: {
    from: (...args: unknown[]) => from(...args),
  },
}));

import { completeDailyPlanItem } from "./dailyActivity";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_ID = "plan-1";
const SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "dailyActivity.ts"),
  "utf8",
);

function activityQuery(options: {
  insertResult: { data: unknown; error: unknown };
  existing?: unknown;
  listed: unknown[];
}) {
  const listed = { data: options.listed, error: null };
  const query: {
    select: () => typeof query;
    insert: (payload: unknown) => unknown;
    eq: () => typeof query;
    maybeSingle: () => Promise<unknown>;
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
  } = {
    select: () => query,
    insert: (payload: Record<string, unknown>) => {
      expect(payload).not.toHaveProperty("user_id");
      expect(payload).not.toHaveProperty("local_date");
      return {
        select: () => ({
          maybeSingle: () => Promise.resolve(options.insertResult),
        }),
      };
    },
    eq: () => query,
    maybeSingle: () => Promise.resolve({ data: options.existing, error: null }),
    then: (resolve, reject) => Promise.resolve(listed).then(resolve, reject),
  };
  return query;
}

describe("completeDailyPlanItem", () => {
  const items = buildDailyPlanSnapshot({
    localDate: "2026-09-19",
    primaryGoal: "stress",
    preferredDurationMinutes: 5,
    selectedLessonId: "l1",
    enrollment: null,
  }).items;

  const existing = {
    id: "act-1",
    user_id: USER_ID,
    daily_plan_id: PLAN_ID,
    item_key: "mood_checkin",
    item_type: "mood_checkin",
    completed_at: "2026-09-19T01:00:00.000Z",
  };

  beforeEach(() => {
    from.mockReset();
  });

  it("does not send a client-provided user_id or local_date on insert", () => {
    const insertBody = SOURCE.slice(
      SOURCE.indexOf("const row = {"),
      SOURCE.indexOf("const { data: inserted"),
    );
    expect(insertBody).not.toContain("user_id");
    expect(insertBody).not.toContain("local_date");
  });

  it("is idempotent when the same item_key is completed twice", async () => {
    from.mockImplementation((table: string) => {
      expect(table).toBe("user_daily_activity");
      return activityQuery({
        insertResult: {
          data: null,
          error: { code: "23505", message: "duplicate key value" },
        },
        existing,
        listed: [existing],
      });
    });

    const first = await completeDailyPlanItem(
      USER_ID,
      {
        daily_plan_id: PLAN_ID,
        local_date: "2026-09-19",
        item_key: "mood_checkin",
        item_type: "mood_checkin",
        mood_score: 3,
      },
      items,
    );
    const second = await completeDailyPlanItem(
      USER_ID,
      {
        daily_plan_id: PLAN_ID,
        local_date: "2026-09-19",
        item_key: "mood_checkin",
        item_type: "mood_checkin",
        mood_score: 5,
      },
      items,
    );

    expect(first.activity.id).toBe("act-1");
    expect(second.activity.id).toBe("act-1");
    expect(first.planComplete).toBe(false);
    expect(second.planComplete).toBe(false);
  });
});

describe("listDailyActivityInRange", () => {
  it("is a user-scoped read of a local-date range", () => {
    const body = SOURCE.slice(
      SOURCE.indexOf("export async function listDailyActivityInRange"),
      SOURCE.indexOf("export async function listDailyActivity("),
    );
    expect(body).toContain('.from("user_daily_activity")');
    expect(body).toContain('.eq("user_id", userId)');
    expect(body).not.toContain(".insert(");
  });
});
