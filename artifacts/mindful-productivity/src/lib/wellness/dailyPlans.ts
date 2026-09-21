import supabase from "../supabase";
import { buildDailyPlanSnapshot } from "./dailyPlan";
import { logSanitizedWellnessError } from "./errors";
import type { WellnessDailyPlanCompletion } from "./errors";
import { localDateKey } from "./localDate";
import type {
  DailyPlanSnapshot,
  DailyPlanSnapshotDraft,
  PreferredDurationMinutes,
  PrimaryGoal,
  ProgramEnrollment,
} from "./types";

export type { WellnessDailyPlanCompletion } from "./errors";

function isUniqueViolation(error: { code?: string | null; message?: string | null }): boolean {
  if (error.code === "23505") return true;
  return /duplicate key/i.test(error.message ?? "");
}

export async function listDailyPlansInRange(
  userId: string,
  startLocalDate: string,
  endLocalDate: string,
): Promise<DailyPlanSnapshot[]> {
  const { data, error } = await supabase
    .from("user_daily_plans")
    .select("*")
    .eq("user_id", userId)
    .gte("local_date", startLocalDate)
    .lte("local_date", endLocalDate)
    .order("local_date", { ascending: true });
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  return (data ?? []) as DailyPlanSnapshot[];
}

export async function getDailyPlanForDate(
  userId: string,
  localDate: string,
): Promise<DailyPlanSnapshot | null> {
  const { data, error } = await supabase
    .from("user_daily_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  return (data as DailyPlanSnapshot | null) ?? null;
}

/**
 * Returns the existing snapshot for user_id + local_date when present.
 * Never overwrites today's stored plan if preferences or ranking change later.
 */
export async function ensureDailyPlan(
  userId: string,
  draft: DailyPlanSnapshotDraft,
): Promise<DailyPlanSnapshot> {
  const existing = await getDailyPlanForDate(userId, draft.local_date);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("user_daily_plans")
    .insert({
      local_date: draft.local_date,
      enrollment_id: draft.enrollment_id,
      program_slug: draft.program_slug,
      program_day: draft.program_day,
      primary_goal: draft.primary_goal,
      plan_version: draft.plan_version,
      lesson_id: draft.lesson_id,
      items: draft.items,
    })
    .select()
    .maybeSingle();

  if (!error && data) {
    return data as DailyPlanSnapshot;
  }

  if (error && isUniqueViolation(error)) {
    const raced = await getDailyPlanForDate(userId, draft.local_date);
    if (raced) return raced;
  }

  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  throw new Error("Daily plan snapshot could not be created");
}

export function planLocalDate(timezone: string, now: Date = new Date()): string {
  return localDateKey(timezone, now);
}

/**
 * Reuses today's snapshot when present. Creates once per user + local date.
 * Never overwrites an existing plan. Unique races reload the stored row.
 */
export async function loadOrCreateDailyPlan(input: {
  userId: string;
  localDate: string;
  primaryGoal: PrimaryGoal;
  preferredDurationMinutes: PreferredDurationMinutes;
  selectedLessonId: string | null;
  enrollment: Pick<ProgramEnrollment, "id" | "program_slug" | "current_day" | "status"> | null;
}): Promise<DailyPlanSnapshot> {
  const existing = await getDailyPlanForDate(input.userId, input.localDate);
  if (existing) return existing;

  const draft = buildDailyPlanSnapshot({
    localDate: input.localDate,
    primaryGoal: input.primaryGoal,
    preferredDurationMinutes: input.preferredDurationMinutes,
    selectedLessonId: input.selectedLessonId,
    enrollment: input.enrollment,
  });
  return ensureDailyPlan(input.userId, draft);
}

/**
 * Production authority for Daily Plan completion and enrollment progression.
 * Not wired to UI in Phase 1B.
 */
export async function completeWellnessDailyPlan(
  planId: string,
): Promise<WellnessDailyPlanCompletion> {
  const { data, error } = await supabase.rpc("complete_wellness_daily_plan", {
    p_plan_id: planId,
  });
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Daily Plan completion returned no result");
  }
  return row as WellnessDailyPlanCompletion;
}

/**
 * Direct table write — not production. Authenticated clients have no UPDATE
 * on user_daily_plans; use completeWellnessDailyPlan instead.
 */
export async function markDailyPlanCompleted(
  userId: string,
  planId: string,
  completedAt: string,
): Promise<DailyPlanSnapshot> {
  const { data, error } = await supabase
    .from("user_daily_plans")
    .update({ completed_at: completedAt })
    .eq("id", planId)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  return data as DailyPlanSnapshot;
}
