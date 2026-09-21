import type { LessonRow } from "../lessons";
import { CATEGORIES, type Category } from "../lessons";
import { t, type LanguageCode } from "../translations";
import { sevenLocalDateRange, shiftLocalDate } from "./localDate";
import type { PrimaryGoal, ProgramSlug } from "./types";
import { isProgramSlug } from "./types";

export const RECENT_INSIGHT_WINDOW_DAYS = 7;

/** Explicit program → lesson category mapping. Never inferred from title/body. */
export const PROGRAM_INSIGHT_CATEGORIES: Record<ProgramSlug, readonly Category[]> = {
  "calm-reset": ["anxiety", "cbt"],
  "better-sleep": ["anxiety", "cbt"],
  "focus-habit": ["habits", "procrastination", "motivation"],
};

/** Explicit primary-goal → lesson category mapping. Never inferred from title/body. */
export const GOAL_INSIGHT_CATEGORIES: Record<PrimaryGoal, readonly Category[]> = {
  stress: ["anxiety", "cbt"],
  sleep: ["anxiety", "cbt"],
  focus: ["procrastination", "cbt"],
  motivation: ["motivation"],
  self_compassion: ["cbt", "anxiety"],
  habit: ["habits", "procrastination"],
};

export const INSIGHT_SCORE_WEIGHTS = {
  program: 40,
  goal: 25,
  unseen: 20,
  recentRepeat: -30,
  helpfulTheme: 12,
  unhelpfulLesson: -18,
  unhelpfulTheme: -8,
  leastRecent: 1,
} as const;

export const INSIGHT_REASON_KEYS = [
  "snapshot",
  "program",
  "goal",
  "unseen",
  "helpful_theme",
  "alternative",
  "available",
  "locale_fallback",
] as const;

export type InsightReasonKey = (typeof INSIGHT_REASON_KEYS)[number];

export interface LessonProgressSignal {
  lessonId: string;
  readAt: string;
  helpful: boolean | null;
  localDate?: string;
}

export interface InsightReadSignal {
  lessonId: string;
  localDate: string;
}

export interface InsightScoreBreakdown {
  program: number;
  goal: number;
  unseen: number;
  recentRepeat: number;
  helpfulTheme: number;
  unhelpfulLesson: number;
  unhelpfulTheme: number;
  leastRecent: number;
  total: number;
}

export interface RankedInsightCandidate {
  lesson: LessonRow;
  breakdown: InsightScoreBreakdown;
  tieBreak: number;
}

export interface AdaptiveInsightInput {
  lessons: LessonRow[];
  localDate: string;
  locale?: string;
  primaryGoal?: PrimaryGoal | null;
  programSlug?: ProgramSlug | string | null;
  programDay?: number | null;
  existingLessonId?: string | null;
  progress?: LessonProgressSignal[];
  insightReads?: InsightReadSignal[];
  historyUnavailable?: boolean;
  localeFallback?: boolean;
}

export interface AdaptiveInsightResult {
  lesson: LessonRow | null;
  lessonId: string | null;
  reasonKey: InsightReasonKey;
  ranked: RankedInsightCandidate[];
  usedSnapshot: boolean;
  usedFallback: boolean;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function isSelectableLesson(lesson: Pick<LessonRow, "id" | "title" | "content" | "active">): boolean {
  return Boolean(lesson.id && lesson.title && lesson.content) && lesson.active !== false;
}

/** Deterministic Daily Insight pick for a local date. Stable for the same catalog + date. */
export function selectDailyInsightLessonId(
  lessons: Pick<LessonRow, "id">[],
  localDate: string,
): string | null {
  const ids = [...new Set(lessons.map((lesson) => lesson.id).filter(Boolean))].sort();
  if (ids.length === 0) return null;
  const index = hashString(localDate) % ids.length;
  return ids[index] ?? null;
}

export function resolveDailyInsightLesson(
  lessons: LessonRow[],
  lessonId: string | null | undefined,
): LessonRow | null {
  if (!lessonId) return null;
  return lessons.find((lesson) => lesson.id === lessonId && isSelectableLesson(lesson)) ?? null;
}

export function isBundledLessonId(lessonId: string): boolean {
  return lessonId.startsWith("local-");
}

function recentDateSet(today: string): Set<string> {
  return new Set(sevenLocalDateRange(today).dates);
}

function localDateFromReadAt(readAt: string, fallbackDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(readAt)) return readAt;
  const parsed = new Date(readAt);
  if (Number.isNaN(parsed.getTime())) return fallbackDate;
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-${String(parsed.getUTCDate()).padStart(2, "0")}`;
}

function daysBetween(earlier: string, later: string): number {
  let days = 0;
  let cursor = earlier;
  while (cursor < later && days < 4000) {
    cursor = shiftLocalDate(cursor, 1);
    days += 1;
  }
  return days;
}

function winningReason(
  breakdown: InsightScoreBreakdown,
  options: { localeFallback: boolean; anyNegativeFeedback: boolean },
): InsightReasonKey {
  const ranked: Array<[InsightReasonKey, number]> = [
    ["program", breakdown.program],
    ["goal", breakdown.goal],
    ["unseen", breakdown.unseen],
    ["helpful_theme", breakdown.helpfulTheme],
  ];
  const best = ranked.reduce((lead, next) => (next[1] > lead[1] ? next : lead));
  if (best[1] > 0) return best[0];
  if (options.anyNegativeFeedback && breakdown.unhelpfulLesson === 0) return "alternative";
  if (options.localeFallback) return "locale_fallback";
  return "available";
}

export function selectAdaptiveDailyInsight(input: AdaptiveInsightInput): AdaptiveInsightResult {
  const candidates = input.lessons.filter(isSelectableLesson);
  const existing = resolveDailyInsightLesson(candidates, input.existingLessonId);
  if (existing) {
    return {
      lesson: existing,
      lessonId: existing.id,
      reasonKey: "snapshot",
      ranked: [{
        lesson: existing,
        breakdown: {
          program: 0,
          goal: 0,
          unseen: 0,
          recentRepeat: 0,
          helpfulTheme: 0,
          unhelpfulLesson: 0,
          unhelpfulTheme: 0,
          leastRecent: 0,
          total: 0,
        },
        tieBreak: 0,
      }],
      usedSnapshot: true,
      usedFallback: false,
    };
  }

  if (candidates.length === 0) {
    return {
      lesson: null,
      lessonId: null,
      reasonKey: input.localeFallback ? "locale_fallback" : "available",
      ranked: [],
      usedSnapshot: false,
      usedFallback: true,
    };
  }

  if (input.historyUnavailable) {
    const fallbackId = selectDailyInsightLessonId(candidates, input.localDate);
    const lesson = resolveDailyInsightLesson(candidates, fallbackId);
    return {
      lesson,
      lessonId: lesson?.id ?? null,
      reasonKey: "available",
      ranked: [],
      usedSnapshot: false,
      usedFallback: true,
    };
  }

  const recentDates = recentDateSet(input.localDate);
  const programSlug = isProgramSlug(input.programSlug) ? input.programSlug : null;
  const programCats = new Set(programSlug ? PROGRAM_INSIGHT_CATEGORIES[programSlug] : []);
  const goalCats = new Set(input.primaryGoal ? GOAL_INSIGHT_CATEGORIES[input.primaryGoal] : []);
  const progress = input.progress ?? [];
  const insightReads = input.insightReads ?? [];

  const lastReadByLesson = new Map<string, string>();
  const helpfulByCategory = new Map<Category, boolean>();
  const unhelpfulLessons = new Set<string>();
  const unhelpfulCategories = new Set<Category>();

  for (const row of progress) {
    const localDate = row.localDate ?? localDateFromReadAt(row.readAt, input.localDate);
    const previous = lastReadByLesson.get(row.lessonId);
    if (!previous || localDate > previous) lastReadByLesson.set(row.lessonId, localDate);
    const lesson = candidates.find((item) => item.id === row.lessonId);
    const category = lesson && isCategory(lesson.category) ? lesson.category : null;
    if (row.helpful === true && category) helpfulByCategory.set(category, true);
    if (row.helpful === false) {
      unhelpfulLessons.add(row.lessonId);
      if (category && recentDates.has(localDate)) unhelpfulCategories.add(category);
    }
  }
  for (const row of insightReads) {
    const previous = lastReadByLesson.get(row.lessonId);
    if (!previous || row.localDate > previous) lastReadByLesson.set(row.lessonId, row.localDate);
  }

  const allRead = candidates.every((lesson) => lastReadByLesson.has(lesson.id));
  const anyNegativeFeedback = unhelpfulLessons.size > 0 || unhelpfulCategories.size > 0;
  const programDay = input.programDay ?? 0;
  const programKey = programSlug ?? "";

  const ranked: RankedInsightCandidate[] = candidates.map((lesson) => {
    const category = isCategory(lesson.category) ? lesson.category : null;
    const lastRead = lastReadByLesson.get(lesson.id);
    const unseen = lastRead == null;
    const recentRepeat = lastRead != null && recentDates.has(lastRead);
    const breakdown: InsightScoreBreakdown = {
      program: category && programCats.has(category) ? INSIGHT_SCORE_WEIGHTS.program : 0,
      goal: category && goalCats.has(category) ? INSIGHT_SCORE_WEIGHTS.goal : 0,
      unseen: unseen ? INSIGHT_SCORE_WEIGHTS.unseen : 0,
      recentRepeat: recentRepeat ? INSIGHT_SCORE_WEIGHTS.recentRepeat : 0,
      helpfulTheme: category && helpfulByCategory.get(category) ? INSIGHT_SCORE_WEIGHTS.helpfulTheme : 0,
      unhelpfulLesson: unhelpfulLessons.has(lesson.id) ? INSIGHT_SCORE_WEIGHTS.unhelpfulLesson : 0,
      unhelpfulTheme:
        category && unhelpfulCategories.has(category) && !unhelpfulLessons.has(lesson.id)
          ? INSIGHT_SCORE_WEIGHTS.unhelpfulTheme
          : 0,
      leastRecent: 0,
      total: 0,
    };
    if (allRead && lastRead) {
      breakdown.leastRecent = daysBetween(lastRead, input.localDate) * INSIGHT_SCORE_WEIGHTS.leastRecent;
    } else if (allRead && !lastRead) {
      breakdown.leastRecent = 4000;
    }
    breakdown.total =
      breakdown.program +
      breakdown.goal +
      breakdown.unseen +
      breakdown.recentRepeat +
      breakdown.helpfulTheme +
      breakdown.unhelpfulLesson +
      breakdown.unhelpfulTheme +
      breakdown.leastRecent;
    const tieBreak = hashString(`${input.localDate}|${programKey}|${programDay}|${lesson.id}`);
    return { lesson, breakdown, tieBreak };
  });

  ranked.sort((a, b) => {
    if (b.breakdown.total !== a.breakdown.total) return b.breakdown.total - a.breakdown.total;
    if (a.tieBreak !== b.tieBreak) return a.tieBreak - b.tieBreak;
    return a.lesson.id.localeCompare(b.lesson.id);
  });

  const selected = ranked[0]!;
  const sparse =
    !programSlug &&
    !input.primaryGoal &&
    progress.length === 0 &&
    insightReads.length === 0;

  return {
    lesson: selected.lesson,
    lessonId: selected.lesson.id,
    reasonKey: sparse
      ? input.localeFallback
        ? "locale_fallback"
        : "available"
      : winningReason(selected.breakdown, {
          localeFallback: Boolean(input.localeFallback),
          anyNegativeFeedback,
        }),
    ranked,
    usedSnapshot: false,
    usedFallback: sparse,
  };
}

export function dailyInsightReasonCopy(
  language: LanguageCode,
  reasonKey: InsightReasonKey,
  values?: { program?: string; goal?: string },
): string {
  if (reasonKey === "program") {
    return t(language, "dailyInsight.reason.program", { program: values?.program ?? "" });
  }
  if (reasonKey === "goal") {
    return t(language, "dailyInsight.reason.goal", { goal: values?.goal ?? "" });
  }
  return t(language, `dailyInsight.reason.${reasonKey}`);
}
