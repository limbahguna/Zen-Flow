import { describe, expect, it } from "vitest";
import { DAILY_PLAN_ITEM_KEYS } from "./types";
import type { DailyActivity, DailyPlanItem, DailyPlanSnapshot, ProgramEnrollment } from "./types";
import {
  aggregateWeeklyProgress,
  dailyPlanStreak,
  moodDirectionFromScores,
} from "./weeklyProgress";

const TODAY = "2026-09-20";

function items(required: DailyPlanItem[] = defaultItems()): DailyPlanItem[] {
  return required;
}

function defaultItems(requiredKeys: typeof DAILY_PLAN_ITEM_KEYS[number][] = [...DAILY_PLAN_ITEM_KEYS]): DailyPlanItem[] {
  return requiredKeys.map((key) =>
    key === "program_practice"
      ? {
          item_key: "program_practice",
          item_type: "program_practice",
          required: true,
          planned_minutes: 5,
          practice_kind: "breathing",
        }
      : {
          item_key: key,
          item_type: key,
          required: key !== "reflection",
          planned_minutes: 1,
        },
  );
}

function plan(overrides: Partial<DailyPlanSnapshot> = {}): DailyPlanSnapshot {
  return {
    id: "plan-1",
    user_id: "user-1",
    local_date: TODAY,
    enrollment_id: "enroll-1",
    program_slug: "calm-reset",
    program_day: 1,
    primary_goal: "stress",
    plan_version: 1,
    lesson_id: "local-1",
    items: defaultItems(),
    completed_at: null,
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    ...overrides,
  };
}

function activity(overrides: Partial<DailyActivity> & Pick<DailyActivity, "item_key">): DailyActivity {
  return {
    id: `act-${overrides.item_key}-${overrides.daily_plan_id ?? "plan-1"}`,
    user_id: "user-1",
    daily_plan_id: "plan-1",
    local_date: TODAY,
    item_type: overrides.item_key,
    practice_kind: null,
    duration_minutes: null,
    mood_score: null,
    reflection_text: null,
    completed_at: "2026-09-20T01:00:00.000Z",
    created_at: "2026-09-20T01:00:00.000Z",
    ...overrides,
  };
}

const ACTIVE: ProgramEnrollment = {
  id: "enroll-1",
  user_id: "user-1",
  program_slug: "calm-reset",
  status: "active",
  current_day: 2,
  started_on: "2026-09-19",
  completed_on: null,
  created_at: "2026-09-19T00:00:00Z",
  updated_at: "2026-09-20T00:00:00Z",
};

describe("aggregateWeeklyProgress", () => {
  it("marks completed, partial, and no-plan dates in the rolling range", () => {
    const report = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [
        plan({ id: "p1", local_date: "2026-09-18", completed_at: "2026-09-18T02:00:00Z" }),
        plan({ id: "p2", local_date: "2026-09-19", completed_at: null }),
      ],
      activities: [],
    });
    expect(report.dates[0]).toBe("2026-09-14");
    expect(report.dates[6]).toBe("2026-09-20");
    expect(report.days.find((day) => day.localDate === "2026-09-18")?.state).toBe("completed");
    expect(report.days.find((day) => day.localDate === "2026-09-19")?.state).toBe("partial");
    expect(report.days.find((day) => day.localDate === "2026-09-17")?.state).toBe("none");
    expect(report.days.find((day) => day.localDate === TODAY)?.isToday).toBe(true);
    expect(report.days.some((day) => day.localDate > TODAY)).toBe(false);
  });

  it("computes plan completion rate and avoids dividing by zero", () => {
    const withPlans = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [
        plan({ id: "a", local_date: "2026-09-18", completed_at: "2026-09-18T02:00:00Z" }),
        plan({ id: "b", local_date: "2026-09-19", completed_at: null }),
      ],
      activities: [],
    });
    expect(withPlans.plansCreated).toBe(2);
    expect(withPlans.plansCompleted).toBe(1);
    expect(withPlans.planCompletionRate).toBe(0.5);

    const empty = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [],
      activities: [],
    });
    expect(empty.plansCreated).toBe(0);
    expect(empty.planCompletionRate).toBeNull();
  });

  it("computes required-item completion without double-counting activity rows", () => {
    const snapshot = plan({
      id: "plan-req",
      items: items(defaultItems(["mood_checkin", "daily_insight", "program_practice", "reflection"])),
    });
    const report = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [snapshot],
      activities: [
        activity({ item_key: "mood_checkin", daily_plan_id: "plan-req" }),
        activity({ id: "dup", item_key: "mood_checkin", daily_plan_id: "plan-req" }),
        activity({ item_key: "daily_insight", daily_plan_id: "plan-req" }),
      ],
    });
    expect(report.requiredTotal).toBe(3);
    expect(report.requiredCompleted).toBe(2);
    expect(report.requiredRate).toBeCloseTo(2 / 3);
  });

  it("counts practices and only recorded minutes", () => {
    const withMinutes = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [plan()],
      activities: [
        activity({ item_key: "program_practice", duration_minutes: 5 }),
        activity({ item_key: "program_practice", daily_plan_id: "plan-2", local_date: "2026-09-19", duration_minutes: 3 }),
      ],
    });
    expect(withMinutes.practiceCount).toBe(2);
    expect(withMinutes.practiceMinutes).toBe(8);

    const missing = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [plan()],
      activities: [activity({ item_key: "program_practice", duration_minutes: null })],
    });
    expect(missing.practiceCount).toBe(1);
    expect(missing.practiceMinutes).toBeNull();
  });

  it("counts Daily Insight reads from plan activity, not lesson feedback", () => {
    const report = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [plan()],
      activities: [
        activity({ item_key: "daily_insight" }),
        activity({ item_key: "daily_insight", id: "dup-insight" }),
      ],
    });
    expect(report.insightReadCount).toBe(1);
  });

  it("averages mood and describes direction only with two or more scores", () => {
    const enough = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [plan(), plan({ id: "plan-2", local_date: "2026-09-19" })],
      activities: [
        activity({ item_key: "mood_checkin", mood_score: 2, local_date: "2026-09-19", daily_plan_id: "plan-2", completed_at: "2026-09-19T01:00:00Z" }),
        activity({ item_key: "mood_checkin", mood_score: 4, completed_at: "2026-09-20T01:00:00Z" }),
      ],
    });
    expect(enough.moodCount).toBe(2);
    expect(enough.moodAverage).toBe(3);
    expect(enough.moodDirection).toBe("higher");

    const sparse = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [plan()],
      activities: [activity({ item_key: "mood_checkin", mood_score: 4 })],
    });
    expect(sparse.moodDirection).toBe("none");
    expect(moodDirectionFromScores([])).toBe("none");
  });

  it("counts reflections without exposing text", () => {
    const report = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [plan()],
      activities: [activity({ item_key: "reflection", reflection_text: "private note" })],
    });
    expect(report.reflectionCount).toBe(1);
    expect(JSON.stringify(report)).not.toContain("private note");
  });

  it("shows Day X of Y from the catalog and completed-program state", () => {
    const active = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: ACTIVE,
      plans: [],
      activities: [],
    });
    expect(active.programDay).toBe(2);
    expect(active.programDuration).toBe(7);
    expect(active.completedProgramDays).toBe(1);
    expect(active.programPercent).toBe(14);
    expect(active.programCompleted).toBe(false);

    const done = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: { ...ACTIVE, status: "completed", current_day: 7, completed_on: TODAY },
      plans: [],
      activities: [],
    });
    expect(done.programCompleted).toBe(true);
    expect(done.completedProgramDays).toBe(7);
    expect(done.programPercent).toBe(100);
  });

  it("handles no enrollment and sparse weekly data", () => {
    const report = aggregateWeeklyProgress({
      today: TODAY,
      enrollment: null,
      plans: [plan({ local_date: "2026-09-20", completed_at: null })],
      activities: [],
    });
    expect(report.programSlug).toBeNull();
    expect(report.plansCreated).toBe(1);
    expect(report.streak).toBe(0);
    expect(report.moodDirection).toBe("none");
  });
});

describe("dailyPlanStreak", () => {
  it("ends today when today is completed", () => {
    expect(dailyPlanStreak(["2026-09-18", "2026-09-19", "2026-09-20"], TODAY)).toBe(3);
  });

  it("ends yesterday when today is not completed", () => {
    expect(dailyPlanStreak(["2026-09-18", "2026-09-19"], TODAY)).toBe(2);
  });

  it("breaks on a missed date", () => {
    expect(dailyPlanStreak(["2026-09-17", "2026-09-19", "2026-09-20"], TODAY)).toBe(2);
    expect(dailyPlanStreak(["2026-09-17"], TODAY)).toBe(0);
  });
});
