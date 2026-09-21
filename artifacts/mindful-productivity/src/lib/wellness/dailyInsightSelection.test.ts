import { describe, expect, it } from "vitest";
import type { LessonRow } from "../lessons";
import {
  dailyInsightReasonCopy,
  isBundledLessonId,
  resolveDailyInsightLesson,
  selectAdaptiveDailyInsight,
  selectDailyInsightLessonId,
} from "./dailyInsightSelection";

function lesson(id: string, category: LessonRow["category"], extra: Partial<LessonRow> = {}): LessonRow {
  return {
    id,
    title: id,
    content: `${id} body`,
    category,
    reading_time_minutes: 2,
    sort_order: 1,
    active: true,
    created_at: "2026-09-20T00:00:00Z",
    ...extra,
  };
}

const UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOCAL = "local-proc-7";
const ANXIETY = lesson("local-anx-7", "anxiety");
const HABIT = lesson("local-hab-1", "habits");
const PROC = lesson(LOCAL, "procrastination");
const UUID_CBT = lesson(UUID, "cbt");
const MOTIV = lesson("local-mot-5", "motivation");
const CATALOG = [ANXIETY, HABIT, PROC, UUID_CBT, MOTIV];

describe("selectDailyInsightLessonId", () => {
  it("picks a stable id for the same local date, including UUID and local-* ids", () => {
    const first = selectDailyInsightLessonId(CATALOG, "2026-09-20");
    const second = selectDailyInsightLessonId(CATALOG, "2026-09-20");
    expect(first).toBe(second);
    expect(CATALOG.some((row) => row.id === first)).toBe(true);
  });

  it("can select a UUID lesson and a bundled local-* lesson from mixed catalogs", () => {
    const uuidOnly = selectDailyInsightLessonId([{ id: UUID }], "2026-09-20");
    const localOnly = selectDailyInsightLessonId([{ id: LOCAL }], "2026-09-20");
    expect(uuidOnly).toBe(UUID);
    expect(localOnly).toBe(LOCAL);
    expect(isBundledLessonId(localOnly!)).toBe(true);
    expect(isBundledLessonId(uuidOnly!)).toBe(false);
  });
});

describe("selectAdaptiveDailyInsight", () => {
  it("always uses a valid existing snapshot lesson", () => {
    const first = selectAdaptiveDailyInsight({
      lessons: CATALOG,
      localDate: "2026-09-20",
      existingLessonId: LOCAL,
      programSlug: "calm-reset",
      primaryGoal: "stress",
    });
    const afterFeedback = selectAdaptiveDailyInsight({
      lessons: CATALOG,
      localDate: "2026-09-20",
      existingLessonId: LOCAL,
      programSlug: "focus-habit",
      primaryGoal: "habit",
      progress: [{ lessonId: LOCAL, readAt: "2026-09-20T01:00:00Z", helpful: false, localDate: "2026-09-20" }],
    });
    expect(first.lessonId).toBe(LOCAL);
    expect(afterFeedback.lessonId).toBe(LOCAL);
    expect(first.usedSnapshot).toBe(true);
    expect(afterFeedback.reasonKey).toBe("snapshot");
    expect(first.lessonId).toBe(afterFeedback.lessonId);
  });

  it("prefers exact-locale candidates supplied by the catalog", () => {
    const result = selectAdaptiveDailyInsight({
      lessons: [PROC, HABIT],
      localDate: "2026-09-21",
      localeFallback: false,
    });
    expect(["local-proc-7", "local-hab-1"]).toContain(result.lessonId);
    expect(result.lesson?.title).toBe(result.lessonId);
  });

  it("selects UUID and local-* lesson IDs", () => {
    expect(
      selectAdaptiveDailyInsight({ lessons: [UUID_CBT], localDate: "2026-09-21" }).lessonId,
    ).toBe(UUID);
    expect(
      selectAdaptiveDailyInsight({ lessons: [PROC], localDate: "2026-09-21" }).lessonId,
    ).toBe(LOCAL);
  });

  it("boosts program-relevant categories", () => {
    const result = selectAdaptiveDailyInsight({
      lessons: [HABIT, ANXIETY],
      localDate: "2026-09-21",
      programSlug: "calm-reset",
      programDay: 2,
    });
    expect(result.lessonId).toBe("local-anx-7");
    expect(result.reasonKey).toBe("program");
  });

  it("boosts primary-goal relevance when no program is active", () => {
    const result = selectAdaptiveDailyInsight({
      lessons: [HABIT, MOTIV],
      localDate: "2026-09-21",
      primaryGoal: "motivation",
    });
    expect(result.lessonId).toBe("local-mot-5");
    expect(result.reasonKey).toBe("goal");
  });

  it("prefers unseen lessons", () => {
    const result = selectAdaptiveDailyInsight({
      lessons: [HABIT, MOTIV],
      localDate: "2026-09-21",
      insightReads: [{ lessonId: "local-hab-1", localDate: "2026-09-20" }],
    });
    expect(result.lessonId).toBe("local-mot-5");
    expect(result.reasonKey).toBe("unseen");
  });

  it("penalizes a lesson read in the previous seven local dates", () => {
    const result = selectAdaptiveDailyInsight({
      lessons: [HABIT, MOTIV],
      localDate: "2026-09-21",
      insightReads: [{ lessonId: "local-mot-5", localDate: "2026-09-20" }],
    });
    expect(result.lessonId).toBe("local-hab-1");
  });

  it("boosts a category after helpful feedback", () => {
    const otherAnxiety = lesson("local-anx-8", "anxiety");
    const withCatalog = selectAdaptiveDailyInsight({
      lessons: [HABIT, ANXIETY, otherAnxiety],
      localDate: "2026-09-21",
      insightReads: [
        { lessonId: "local-hab-1", localDate: "2026-09-01" },
        { lessonId: "local-anx-7", localDate: "2026-09-01" },
        { lessonId: "local-anx-8", localDate: "2026-09-01" },
      ],
      progress: [
        { lessonId: "local-anx-7", readAt: "2026-09-19T00:00:00Z", helpful: true, localDate: "2026-09-19" },
      ],
    });
    expect(withCatalog.ranked.find((row) => row.lesson.category === "anxiety")?.breakdown.helpfulTheme).toBeGreaterThan(0);
    expect(withCatalog.reasonKey).toBe("helpful_theme");
    expect(["local-anx-7", "local-anx-8"]).toContain(withCatalog.lessonId);
  });

  it("reduces immediate repetition after negative feedback without permanently excluding the lesson", () => {
    const recent = selectAdaptiveDailyInsight({
      lessons: [HABIT, MOTIV],
      localDate: "2026-09-21",
      insightReads: [
        { lessonId: "local-hab-1", localDate: "2026-09-01" },
        { lessonId: "local-mot-5", localDate: "2026-09-01" },
      ],
      progress: [
        { lessonId: "local-hab-1", readAt: "2026-09-20T00:00:00Z", helpful: false, localDate: "2026-09-20" },
      ],
    });
    expect(recent.lessonId).toBe("local-mot-5");
    expect(recent.reasonKey).toBe("alternative");

    const later = selectAdaptiveDailyInsight({
      lessons: [HABIT],
      localDate: "2026-10-10",
      progress: [
        { lessonId: "local-hab-1", readAt: "2026-09-20T00:00:00Z", helpful: false, localDate: "2026-09-20" },
      ],
    });
    expect(later.lessonId).toBe("local-hab-1");
  });

  it("chooses the least recently read lesson when every candidate has been read", () => {
    const result = selectAdaptiveDailyInsight({
      lessons: [HABIT, MOTIV],
      localDate: "2026-09-21",
      insightReads: [
        { lessonId: "local-hab-1", localDate: "2026-09-01" },
        { lessonId: "local-mot-5", localDate: "2026-09-20" },
      ],
    });
    expect(result.lessonId).toBe("local-hab-1");
  });

  it("is deterministic for identical inputs and uses a stable tie-break", () => {
    const input = {
      lessons: [lesson("local-a", "habits"), lesson("local-b", "habits")],
      localDate: "2026-09-22",
      programSlug: "focus-habit" as const,
      programDay: 3,
    };
    const first = selectAdaptiveDailyInsight(input);
    const second = selectAdaptiveDailyInsight(input);
    expect(first.lessonId).toBe(second.lessonId);
    expect(first.ranked.map((row) => row.lesson.id)).toEqual(second.ranked.map((row) => row.lesson.id));
  });

  it("falls back when data is sparse or history is unavailable", () => {
    const sparse = selectAdaptiveDailyInsight({
      lessons: CATALOG,
      localDate: "2026-09-21",
    });
    expect(sparse.lessonId).toBeTruthy();
    expect(["available", "locale_fallback"]).toContain(sparse.reasonKey);

    const failed = selectAdaptiveDailyInsight({
      lessons: CATALOG,
      localDate: "2026-09-21",
      historyUnavailable: true,
    });
    expect(failed.usedFallback).toBe(true);
    expect(failed.lessonId).toBe(selectDailyInsightLessonId(CATALOG, "2026-09-21"));

    const noProgram = selectAdaptiveDailyInsight({
      lessons: CATALOG,
      localDate: "2026-09-21",
      primaryGoal: "sleep",
    });
    expect(noProgram.reasonKey).toBe("goal");

    const noPrefs = selectAdaptiveDailyInsight({
      lessons: [PROC],
      localDate: "2026-09-21",
    });
    expect(noPrefs.lessonId).toBe(LOCAL);
  });

  it("uses bundled-only catalogs and excludes invalid candidates", () => {
    const bundled = selectAdaptiveDailyInsight({
      lessons: [PROC, HABIT],
      localDate: "2026-09-21",
      localeFallback: true,
    });
    expect(isBundledLessonId(bundled.lessonId!)).toBe(true);

    const filtered = selectAdaptiveDailyInsight({
      lessons: [
        lesson("inactive", "cbt", { active: false }),
        lesson("empty", "cbt", { content: "" }),
        PROC,
      ],
      localDate: "2026-09-21",
    });
    expect(filtered.lessonId).toBe(LOCAL);
    expect(resolveDailyInsightLesson([PROC], "missing")).toBeNull();
  });

  it("matches explanation copy to the winning rule in EN / ID / JA", () => {
    const program = selectAdaptiveDailyInsight({
      lessons: [ANXIETY, HABIT],
      localDate: "2026-09-21",
      programSlug: "calm-reset",
      programDay: 2,
    });
    expect(program.reasonKey).toBe("program");
    expect(dailyInsightReasonCopy("en", "program", { program: "7-Day Calm Reset" })).toContain("Calm Reset");
    expect(dailyInsightReasonCopy("id", "unseen")).toBe("Sesuatu yang baru untuk hari ini");
    expect(dailyInsightReasonCopy("ja", "available")).toContain("デイリーインサイト");
    expect(dailyInsightReasonCopy("en", "snapshot")).toContain("Daily Plan");
  });
});
