import { describe, expect, it } from "vitest";
import { t } from "../translations";
import { sharePayloadIsPrivateSafe, shareSummaryText, weeklySummaryLines } from "./weeklySummary";
import { aggregateWeeklyProgress } from "./weeklyProgress";
import type { DailyActivity, DailyPlanSnapshot, ProgramEnrollment } from "./types";

const TODAY = "2026-09-20";
const ENROLLMENT: ProgramEnrollment = {
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

function report() {
  const plan: DailyPlanSnapshot = {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "user-1",
    local_date: TODAY,
    enrollment_id: "enroll-1",
    program_slug: "calm-reset",
    program_day: 1,
    primary_goal: "stress",
    plan_version: 1,
    lesson_id: "local-1",
    items: [
      { item_key: "mood_checkin", item_type: "mood_checkin", required: true, planned_minutes: 1 },
      { item_key: "daily_insight", item_type: "daily_insight", required: true, planned_minutes: 2 },
      { item_key: "program_practice", item_type: "program_practice", required: true, planned_minutes: 5, practice_kind: "breathing" },
      { item_key: "reflection", item_type: "reflection", required: false, planned_minutes: 1 },
    ],
    completed_at: "2026-09-20T02:00:00Z",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
  };
  const activities: DailyActivity[] = [
    {
      id: "act-1",
      user_id: "user-1",
      daily_plan_id: plan.id,
      local_date: TODAY,
      item_key: "program_practice",
      item_type: "program_practice",
      practice_kind: "breathing",
      duration_minutes: 5,
      mood_score: null,
      reflection_text: "keep this private",
      completed_at: "2026-09-20T01:00:00Z",
      created_at: "2026-09-20T01:00:00Z",
    },
  ];
  return aggregateWeeklyProgress({ today: TODAY, plans: [plan], activities, enrollment: ENROLLMENT });
}

describe("weekly summary", () => {
  it("is deterministic for the same inputs", () => {
    const first = weeklySummaryLines("en", report());
    const second = weeklySummaryLines("en", report());
    expect(first).toEqual(second);
    expect(first[0]).toBe("You completed your Daily Plan on 1 of the last 7 days.");
  });

  it("renders English, Indonesian, and Japanese summaries", () => {
    const data = report();
    expect(weeklySummaryLines("en", data).join(" ")).toContain("Daily Plan");
    expect(weeklySummaryLines("id", data).join(" ")).toContain("Rencana Harian");
    expect(weeklySummaryLines("ja", data).join(" ")).toContain("デイリープラン");
    expect(t("en", "progress.metrics.insight")).toBe("Daily Insight");
    expect(t("id", "progress.metrics.insight")).toBe("Wawasan Harian");
    expect(t("ja", "progress.metrics.insight")).toBe("デイリーインサイト");
  });

  it("excludes private identifiers and reflection text from the share payload", () => {
    const text = shareSummaryText("en", report());
    expect(sharePayloadIsPrivateSafe(text)).toBe(true);
    expect(text).not.toContain("keep this private");
    expect(text).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(text).not.toContain("user@example.com");
    expect(text).not.toContain("enroll-1");
  });
});
