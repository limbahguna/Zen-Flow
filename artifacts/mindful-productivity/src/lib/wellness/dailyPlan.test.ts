import { describe, expect, it } from "vitest";
import {
  ORDERED_ITEM_KEYS,
  buildDailyPlanSnapshot,
  enrollmentAfterPlanCompletion,
  isDailyPlanComplete,
  requiredItemKeys,
} from "./dailyPlan";
import { DAILY_PLAN_VERSION } from "./types";

const enrollment = {
  id: "enroll-1",
  program_slug: "calm-reset" as const,
  current_day: 1,
  status: "active" as const,
};

describe("buildDailyPlanSnapshot", () => {
  const snapshot = buildDailyPlanSnapshot({
    localDate: "2026-09-19",
    primaryGoal: "stress",
    preferredDurationMinutes: 5,
    selectedLessonId: "local-proc-7",
    enrollment,
  });

  it("emits at most four items in a stable order", () => {
    expect(snapshot.items.length).toBeLessThanOrEqual(4);
    expect(snapshot.items.map((item) => item.item_key)).toEqual([...ORDERED_ITEM_KEYS]);
    expect(snapshot.items.map((item) => item.item_type)).toEqual([...ORDERED_ITEM_KEYS]);
  });

  it("does not persist localized display text", () => {
    const encoded = JSON.stringify(snapshot.items);
    expect(encoded).not.toMatch(/7-Day Calm Reset|Reset Tenang|カームリセット/);
    expect(snapshot.items.every((item) => !("title" in item) && !("label" in item))).toBe(true);
    expect(snapshot.plan_version).toBe(DAILY_PLAN_VERSION);
    expect(snapshot.lesson_id).toBe("local-proc-7");
    expect(snapshot.program_day).toBe(1);
    expect(snapshot.program_slug).toBe("calm-reset");
  });

  it("uses enrollment current_day rather than calendar elapsed days", () => {
    const later = buildDailyPlanSnapshot({
      localDate: "2026-09-22",
      primaryGoal: "stress",
      preferredDurationMinutes: 5,
      selectedLessonId: "local-proc-7",
      enrollment: { ...enrollment, current_day: 1 },
    });
    expect(later.program_day).toBe(1);
    expect(later.items[2]?.practice_kind).toBe(snapshot.items[2]?.practice_kind);
    expect(snapshot.items[2]?.item_type).toBe("program_practice");
    expect(snapshot.items[2]?.practice_kind).toBeTruthy();
  });

  it("builds a goal-based fallback plan when there is no enrollment", () => {
    const fallback = buildDailyPlanSnapshot({
      localDate: "2026-09-19",
      primaryGoal: "sleep",
      preferredDurationMinutes: 10,
      selectedLessonId: null,
      enrollment: null,
    });
    expect(fallback.enrollment_id).toBeNull();
    expect(fallback.program_slug).toBeNull();
    expect(fallback.program_day).toBeNull();
    expect(fallback.primary_goal).toBe("sleep");
    expect(fallback.items).toHaveLength(4);
    expect(fallback.items[2]?.practice_kind).toBe("sleep_routine");
    expect(fallback.lesson_id).toBeNull();
  });
});

describe("program progression helpers", () => {
  const items = buildDailyPlanSnapshot({
    localDate: "2026-09-19",
    primaryGoal: "focus",
    preferredDurationMinutes: 5,
    selectedLessonId: "abc",
    enrollment: {
      id: "e2",
      program_slug: "focus-habit",
      current_day: 21,
      status: "active",
    },
  }).items;

  it("treats the plan as complete only when every required key is done", () => {
    expect(requiredItemKeys(items)).toEqual([...ORDERED_ITEM_KEYS]);
    expect(isDailyPlanComplete(items, ["mood_checkin"])).toBe(false);
    expect(isDailyPlanComplete(items, ORDERED_ITEM_KEYS)).toBe(true);
  });

  it("does not advance current_day when the plan is incomplete, even across missed dates", () => {
    const next = enrollmentAfterPlanCompletion({
      currentDay: 4,
      programSlug: "calm-reset",
      planIsComplete: false,
      localDate: "2026-09-25",
    });
    expect(next.current_day).toBe(4);
    expect(next.status).toBe("active");
    expect(next.completed_on).toBeNull();
  });

  it("advances current_day only after completion", () => {
    const next = enrollmentAfterPlanCompletion({
      currentDay: 3,
      programSlug: "calm-reset",
      planIsComplete: true,
      localDate: "2026-09-19",
    });
    expect(next.current_day).toBe(4);
    expect(next.status).toBe("active");
  });

  it("marks enrollment completed on the final program day", () => {
    const next = enrollmentAfterPlanCompletion({
      currentDay: 7,
      programSlug: "calm-reset",
      planIsComplete: true,
      localDate: "2026-09-19",
    });
    expect(next.current_day).toBe(7);
    expect(next.status).toBe("completed");
    expect(next.completed_on).toBe("2026-09-19");
  });

  it("does not treat optional items as required", () => {
    const mixed = [
      { item_key: "mood_checkin" as const, item_type: "mood_checkin" as const, required: true, planned_minutes: 1 },
      { item_key: "reflection" as const, item_type: "reflection" as const, required: false, planned_minutes: 1 },
    ];
    expect(isDailyPlanComplete(mixed, ["mood_checkin"])).toBe(true);
  });
});
