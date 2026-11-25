import { describe, expect, it } from "vitest";
import { journalDayKey } from "./journalStreak";
import {
  assembleStressDay,
  computeDailyStressEstimate,
  hasThreeDayElevated,
  journalSentimentRequestAllowed,
  mapAnxietyChecks,
  mapFollowThrough,
  mapJournalMood,
  mapMood,
  mapSleep,
  STRESS_WEIGHTS,
  streakBrokeOn,
} from "./stressEstimate";

const calmSleep = {
  quality: 5,
  energy: 5,
  feeling: "rested" as const,
  routineCompleted: true,
};

describe("stress estimate components", () => {
  it("maps anxiety intensity, feeling, missed breathing, max, and mean", () => {
    expect(mapAnxietyChecks([{ intensity: 1, feeling: "neutral", breathingOffered: false, breathingCompleted: false }])?.value).toBe(0);
    expect(mapAnxietyChecks([{ intensity: 10, feeling: "neutral", breathingOffered: false, breathingCompleted: false }])?.value).toBe(100);
    const mixed = mapAnxietyChecks([
      { intensity: 1, feeling: "calm", breathingOffered: false, breathingCompleted: false },
      { intensity: 10, feeling: "anxious", breathingOffered: true, breathingCompleted: false },
    ]);
    expect(mixed?.value).toBe(100);
    expect(mixed?.mean).toBeLessThan(mixed!.value);
  });

  it("maps journal mood and averages it with a rescaled daily-plan mood", () => {
    expect(mapJournalMood(10)).toBe(0);
    expect(mapJournalMood(2)).toBe(100);
    expect(mapMood({ journalMoodAfter: 10, dailyPlanMood: 1 })).toBe(50);
    expect(mapMood({ journalMoodBefore: 6, journalMoodAfter: null, dailyPlanMood: null })).toBe(mapJournalMood(6));
  });

  it("maps sleep from quality, energy, feeling, and a completed routine, with no duration", () => {
    expect(mapSleep({ quality: 5, energy: 5, feeling: "okay", routineCompleted: false })).toBe(0);
    expect(mapSleep(calmSleep)).toBe(0);
    const poor = mapSleep({ quality: 1, energy: 1, feeling: "restless", routineCompleted: false });
    expect(poor).toBe(100);
    expect(mapSleep({ quality: 1, energy: 1, feeling: "okay", routineCompleted: true })).toBe(95);
  });

  it("scores follow-through misses and stays absent when nothing was due", () => {
    expect(mapFollowThrough({
      planExists: false,
      requiredCount: 0,
      missedRequired: 0,
      intentionDue: false,
      intentionMissed: false,
      taskRelevant: false,
      taskAbandonedOrPostponed: false,
    })).toBeNull();
    expect(mapFollowThrough({
      planExists: true,
      requiredCount: 2,
      missedRequired: 1,
      intentionDue: true,
      intentionMissed: true,
      taskRelevant: false,
      taskAbandonedOrPostponed: false,
    })).toBe(65);
  });

  it("treats a streak break of at least 2 as 100 and no history as absent", () => {
    expect(streakBrokeOn(["2026-03-01", "2026-03-02"], "2026-03-03")).toBe(true);
    expect(streakBrokeOn(["2026-03-02"], "2026-03-03")).toBe(false);
    const estimate = computeDailyStressEstimate({
      streak: { hasHistory: false, broke: true },
    });
    expect(estimate.score).toBeNull();
  });
});

describe("computeDailyStressEstimate", () => {
  it("returns no score when nothing was recorded", () => {
    expect(computeDailyStressEstimate({})).toEqual({
      score: null,
      level: "unknown",
      confidence: "none",
      components: {},
      recommendationKeys: [],
    });
  });

  it("renormalizes weights when journal sentiment is absent", () => {
    const estimate = computeDailyStressEstimate({
      anxietyChecks: [{ intensity: 10, feeling: "neutral", breathingOffered: false, breathingCompleted: false }],
      journalMoodAfter: 2,
    });
    const anxietyWeight = estimate.components.anxiety?.weight ?? 0;
    const moodWeight = estimate.components.mood?.weight ?? 0;
    expect(anxietyWeight + moodWeight).toBeCloseTo(1);
    expect(estimate.components.sentiment).toBeUndefined();
    expect(anxietyWeight).toBeCloseTo(STRESS_WEIGHTS.anxiety / (STRESS_WEIGHTS.anxiety + STRESS_WEIGHTS.mood));
  });

  it("includes sentiment only when a 0–100 value is already present", () => {
    const without = computeDailyStressEstimate({
      anxietyChecks: [{ intensity: 1, feeling: "neutral", breathingOffered: false, breathingCompleted: false }],
    });
    const withSentiment = computeDailyStressEstimate({
      anxietyChecks: [{ intensity: 1, feeling: "neutral", breathingOffered: false, breathingCompleted: false }],
      journalSentiment: 100,
    });
    expect(without.components.sentiment).toBeUndefined();
    expect(withSentiment.components.sentiment?.value).toBe(100);
    expect(withSentiment.score).toBeGreaterThan(without.score ?? 0);
  });

  it("assigns levels and confidence, and drops a notch for follow-through only", () => {
    expect(computeDailyStressEstimate({
      anxietyChecks: [{ intensity: 1, feeling: "neutral", breathingOffered: false, breathingCompleted: false }],
    }).level).toBe("calm");
    expect(computeDailyStressEstimate({ journalMoodAfter: 8 }).level).toBe("mild");
    expect(computeDailyStressEstimate({ journalMoodAfter: 6 }).level).toBe("elevated");
    expect(computeDailyStressEstimate({ journalMoodAfter: 2 }).level).toBe("high");

    const one = computeDailyStressEstimate({ journalMoodAfter: 8 });
    expect(one.confidence).toBe("low");
    const two = computeDailyStressEstimate({ journalMoodAfter: 8, sleep: calmSleep });
    expect(two.confidence).toBe("medium");

    const followOnly = computeDailyStressEstimate({
      followThrough: {
        planExists: true,
        requiredCount: 1,
        missedRequired: 1,
        intentionDue: false,
        intentionMissed: false,
        taskRelevant: false,
        taskAbandonedOrPostponed: false,
      },
      streak: { hasHistory: true, broke: true },
    });
    expect(followOnly.confidence).toBe("low");
    expect(computeDailyStressEstimate({
      journalMoodAfter: 8,
      staleSingleSource: true,
    }).confidence).toBe("low");
  });

  it("detects three consecutive elevated or high local dates and breaks on a gap", () => {
    const days = [
      { localDate: "2026-03-01", score: 60, level: "elevated" as const },
      { localDate: "2026-03-02", score: 80, level: "high" as const },
      { localDate: "2026-03-03", score: 55, level: "elevated" as const },
    ];
    expect(hasThreeDayElevated(days, "2026-03-03")).toBe(true);
    expect(hasThreeDayElevated([
      days[0]!,
      { localDate: "2026-03-02", score: null, level: "unknown" },
      days[2]!,
    ], "2026-03-03")).toBe(false);
  });

  it("does not send journal text when consent is off or a score is already cached", () => {
    expect(journalSentimentRequestAllowed(false, null)).toBe(false);
    expect(journalSentimentRequestAllowed(true, 40)).toBe(false);
    expect(journalSentimentRequestAllowed(true, null)).toBe(true);
  });
});

describe("local-date grouping", () => {
  it("groups an instant by the reader's timezone instead of the UTC date slice", () => {
    const createdAt = "2026-03-15T18:30:00.000Z";
    expect(createdAt.slice(0, 10)).toBe("2026-03-15");
    expect(journalDayKey(createdAt, "Asia/Tokyo")).toBe("2026-03-16");

    const assembled = assembleStressDay("2026-03-16", {
      timeZone: "Asia/Tokyo",
      anxietyChecks: [{
        createdAt,
        intensity: 10,
        feeling: "neutral",
        breathingOffered: false,
        breathingCompleted: false,
      }],
    });
    expect(assembled.anxietyChecks).toHaveLength(1);
    const late = assembleStressDay("2026-03-16", {
      timeZone: "Asia/Tokyo",
      intentions: [{
        createdAt: "2026-03-15T16:00:00.000Z",
        status: "done",
        frequency: "daily",
        selectedDays: [],
        completedAt: "2026-03-16T18:00:00.000Z",
      }],
    });
    expect(late.followThrough?.intentionDue).toBe(true);
    expect(late.followThrough?.intentionMissed).toBe(true);
    expect(assembleStressDay("2026-03-15", {
      timeZone: "Asia/Tokyo",
      anxietyChecks: [{
        createdAt,
        intensity: 10,
        feeling: "neutral",
        breathingOffered: false,
        breathingCompleted: false,
      }],
    }).anxietyChecks).toHaveLength(0);
  });
});
