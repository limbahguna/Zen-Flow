/**
 * The weekly headline insight used to be an English sentence built with string
 * templates, so Indonesian and Japanese users saw English. It is now a
 * translation key plus values; these tests pin the selection rules and check
 * that every branch renders in all three launch languages.
 */

import { describe, expect, it } from "vitest";
import { selectWeeklyInsight, type WeeklyInsightInput } from "./weeklyReport";
import { t, type LanguageCode } from "./translations";

const LANGUAGES: LanguageCode[] = ["en", "id", "ja"];

const QUIET: WeeklyInsightInput = {
  moodChange: null,
  completionRate: 0,
  avgMoodImprovement: null,
  currentStreak: 0,
  breathingSessions: 0,
};

describe("selectWeeklyInsight", () => {
  it("leads with easing anxiety when intensity fell meaningfully", () => {
    // anxiety_checks intensity is lower-is-better, so a positive change is relief.
    const insight = selectWeeklyInsight({ ...QUIET, moodChange: 2.25 });
    expect(insight.key).toBe("weekly.insight.anxietyDown");
    expect(insight.values).toEqual({ value: "2.3" });
  });

  it("ignores an anxiety change too small to mention", () => {
    expect(selectWeeklyInsight({ ...QUIET, moodChange: 0.4 }).key).toBe("weekly.insight.default");
  });

  it("never reports rising anxiety as relief", () => {
    expect(selectWeeklyInsight({ ...QUIET, moodChange: -3 }).key).toBe("weekly.insight.default");
  });

  it("falls back to intentions when completion is strong", () => {
    const insight = selectWeeklyInsight({ ...QUIET, completionRate: 75 });
    expect(insight.key).toBe("weekly.insight.intentions");
    expect(insight.values).toEqual({ rate: 75 });
  });

  it("reports the journal mood lift only when it is above a point", () => {
    const insight = selectWeeklyInsight({ ...QUIET, avgMoodImprovement: 1.8 });
    expect(insight.key).toBe("weekly.insight.journalMood");
    expect(insight.values).toEqual({ value: "1.8" });

    expect(selectWeeklyInsight({ ...QUIET, avgMoodImprovement: 0.5 }).key).toBe(
      "weekly.insight.default",
    );
  });

  it("never turns a falling journal mood into a positive headline", () => {
    // Journal mood is higher-is-better, so a negative average is not a lift.
    const insight = selectWeeklyInsight({ ...QUIET, avgMoodImprovement: -2.7 });
    expect(insight.key).toBe("weekly.insight.default");
    expect(t("en", insight.key).toLowerCase()).not.toContain("rising");
  });

  it("uses the streak and breathing headlines at their thresholds", () => {
    expect(selectWeeklyInsight({ ...QUIET, currentStreak: 3 })).toEqual({
      key: "weekly.insight.streak",
      values: { count: 3 },
    });
    expect(selectWeeklyInsight({ ...QUIET, breathingSessions: 4 })).toEqual({
      key: "weekly.insight.breathing",
      values: { count: 4 },
    });
  });

  it("falls back to the encouraging default with no signal at all", () => {
    expect(selectWeeklyInsight(QUIET)).toEqual({ key: "weekly.insight.default", values: {} });
  });

  it("prefers anxiety relief over every other headline", () => {
    const insight = selectWeeklyInsight({
      moodChange: 1.5,
      completionRate: 100,
      avgMoodImprovement: 3,
      currentStreak: 10,
      breathingSessions: 10,
    });
    expect(insight.key).toBe("weekly.insight.anxietyDown");
  });
});

describe("weekly insight rendering", () => {
  const cases: WeeklyInsightInput[] = [
    { ...QUIET, moodChange: 2 },
    { ...QUIET, completionRate: 75 },
    { ...QUIET, avgMoodImprovement: 1.5 },
    { ...QUIET, currentStreak: 5 },
    { ...QUIET, breathingSessions: 5 },
    QUIET,
  ];

  it("renders every branch in every language with no placeholder left over", () => {
    for (const input of cases) {
      const insight = selectWeeklyInsight(input);
      for (const lang of LANGUAGES) {
        const sentence = t(lang, insight.key, insight.values);
        expect(sentence, `${lang} / ${insight.key}`).not.toBe(insight.key);
        expect(sentence, `${lang} / ${insight.key}`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("produces a different sentence per language", () => {
    for (const input of cases) {
      const insight = selectWeeklyInsight(input);
      const english = t("en", insight.key, insight.values);
      expect(t("id", insight.key, insight.values)).not.toBe(english);
      expect(t("ja", insight.key, insight.values)).not.toBe(english);
    }
  });
});
