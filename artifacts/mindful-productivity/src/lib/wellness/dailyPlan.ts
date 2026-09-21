import {
  PRACTICE_CONTENT_KEYS,
  fallbackPracticeKind,
  getProgram,
  getProgramDay,
} from "./programCatalog";
import {
  DAILY_PLAN_ITEM_KEYS,
  DAILY_PLAN_VERSION,
  type DailyPlanItem,
  type DailyPlanItemKey,
  type DailyPlanSnapshotDraft,
  type EnrollmentStatus,
  type PracticeKind,
  type PreferredDurationMinutes,
  type PrimaryGoal,
  type ProgramEnrollment,
  type ProgramSlug,
} from "./types";

export interface BuildDailyPlanInput {
  localDate: string;
  primaryGoal: PrimaryGoal;
  preferredDurationMinutes: PreferredDurationMinutes;
  selectedLessonId: string | null;
  enrollment: Pick<ProgramEnrollment, "id" | "program_slug" | "current_day" | "status"> | null;
}

function clampMinutes(value: number): number {
  return Math.max(1, Math.min(15, Math.round(value)));
}

function item(
  itemKey: Exclude<DailyPlanItemKey, "program_practice">,
  plannedMinutes: number,
  extra: Partial<Extract<DailyPlanItem, { item_key: typeof itemKey }>> = {},
): DailyPlanItem {
  return {
    item_key: itemKey,
    item_type: itemKey,
    required: true,
    planned_minutes: clampMinutes(plannedMinutes),
    ...extra,
  };
}

function practiceItem(
  plannedMinutes: number,
  practiceKind: PracticeKind,
  extra: Partial<Extract<DailyPlanItem, { item_key: "program_practice" }>> = {},
): DailyPlanItem {
  return {
    item_key: "program_practice",
    item_type: "program_practice",
    required: true,
    planned_minutes: clampMinutes(plannedMinutes),
    practice_kind: practiceKind,
    ...extra,
  };
}

export function buildDailyPlanSnapshot(input: BuildDailyPlanInput): DailyPlanSnapshotDraft {
  const enrolled =
    input.enrollment && input.enrollment.status === "active" ? input.enrollment : null;
  const program = enrolled ? getProgram(enrolled.program_slug) : null;
  const programDay = enrolled
    ? Math.min(Math.max(enrolled.current_day, 1), program?.durationDays ?? enrolled.current_day)
    : null;
  const dayDef =
    enrolled && programDay != null ? getProgramDay(enrolled.program_slug, programDay) : null;

  const practiceKind: PracticeKind = dayDef?.practiceKind ?? fallbackPracticeKind(input.primaryGoal);
  const practiceMinutes = dayDef?.plannedMinutes ?? input.preferredDurationMinutes;

  const items: DailyPlanItem[] = [
    item("mood_checkin", 1),
    item("daily_insight", Math.min(2, input.preferredDurationMinutes)),
    practiceItem(practiceMinutes, practiceKind, {
      practice_content_key: dayDef?.practiceContentKey ?? PRACTICE_CONTENT_KEYS[practiceKind],
    }),
    item("reflection", 1, {
      reflection_content_key: dayDef?.reflectionContentKey ?? "programs.reflection.prompt",
    }),
  ];

  return {
    local_date: input.localDate,
    enrollment_id: enrolled?.id ?? null,
    program_slug: enrolled?.program_slug ?? null,
    program_day: programDay,
    primary_goal: input.primaryGoal,
    plan_version: DAILY_PLAN_VERSION,
    lesson_id: input.selectedLessonId,
    items,
    completed_at: null,
  };
}

export function requiredItemKeys(items: DailyPlanItem[]): DailyPlanItemKey[] {
  return items.filter((entry) => entry.required).map((entry) => entry.item_key);
}

export function isDailyPlanComplete(
  items: DailyPlanItem[],
  completedKeys: Iterable<string>,
): boolean {
  const done = new Set(completedKeys);
  const required = requiredItemKeys(items);
  if (required.length === 0) return false;
  return required.every((key) => done.has(key));
}

export interface EnrollmentProgress {
  current_day: number;
  status: EnrollmentStatus;
  completed_on: string | null;
}

/**
 * Program day advances only when the current day's required items are complete.
 * Elapsed calendar dates are ignored.
 *
 * Pure helper for tests and reference. Production progression is
 * `completeWellnessDailyPlan` → `public.complete_wellness_daily_plan(uuid)`.
 */
export function enrollmentAfterPlanCompletion(input: {
  currentDay: number;
  programSlug: ProgramSlug;
  planIsComplete: boolean;
  localDate: string;
}): EnrollmentProgress {
  const duration = getProgram(input.programSlug).durationDays;
  if (!input.planIsComplete) {
    return {
      current_day: input.currentDay,
      status: "active",
      completed_on: null,
    };
  }
  if (input.currentDay >= duration) {
    return {
      current_day: duration,
      status: "completed",
      completed_on: input.localDate,
    };
  }
  return {
    current_day: input.currentDay + 1,
    status: "active",
    completed_on: null,
  };
}

export const ORDERED_ITEM_KEYS: readonly DailyPlanItemKey[] = DAILY_PLAN_ITEM_KEYS;
