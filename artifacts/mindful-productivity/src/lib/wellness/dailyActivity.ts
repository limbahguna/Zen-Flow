import supabase from "../supabase";
import { isDailyPlanComplete } from "./dailyPlan";
import { logSanitizedWellnessError } from "./errors";
import type { DailyActivity, DailyActivityInput, DailyPlanItem } from "./types";

function isUniqueViolation(error: { code?: string | null; message?: string | null }): boolean {
  if (error.code === "23505") return true;
  return /duplicate key/i.test(error.message ?? "");
}

export async function listDailyActivityInRange(
  userId: string,
  startLocalDate: string,
  endLocalDate: string,
): Promise<DailyActivity[]> {
  const { data, error } = await supabase
    .from("user_daily_activity")
    .select("*")
    .eq("user_id", userId)
    .gte("local_date", startLocalDate)
    .lte("local_date", endLocalDate)
    .order("local_date", { ascending: true });
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  return (data ?? []) as DailyActivity[];
}

export async function listDailyActivity(
  userId: string,
  dailyPlanId: string,
): Promise<DailyActivity[]> {
  const { data, error } = await supabase
    .from("user_daily_activity")
    .select("*")
    .eq("user_id", userId)
    .eq("daily_plan_id", dailyPlanId);
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  return (data ?? []) as DailyActivity[];
}

export async function completeDailyPlanItem(
  userId: string,
  input: DailyActivityInput,
  planItems: DailyPlanItem[],
): Promise<{ activity: DailyActivity; planComplete: boolean }> {
  const row = {
    daily_plan_id: input.daily_plan_id,
    item_key: input.item_key,
    item_type: input.item_type,
    practice_kind: input.practice_kind ?? null,
    duration_minutes: input.duration_minutes ?? null,
    mood_score: input.mood_score ?? null,
    reflection_text: input.reflection_text ?? null,
  };

  const { data: inserted, error } = await supabase
    .from("user_daily_activity")
    .insert(row)
    .select()
    .maybeSingle();

  let activity = inserted as DailyActivity | null;
  if (error && isUniqueViolation(error)) {
    const { data: existing, error: fetchError } = await supabase
      .from("user_daily_activity")
      .select("*")
      .eq("daily_plan_id", input.daily_plan_id)
      .eq("item_key", input.item_key)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchError) {
      logSanitizedWellnessError(fetchError);
      throw fetchError;
    }
    activity = existing as DailyActivity | null;
  } else if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }

  if (!activity) {
    throw new Error("Daily activity could not be recorded");
  }

  const all = await listDailyActivity(userId, input.daily_plan_id);
  const planComplete = isDailyPlanComplete(
    planItems,
    all.map((entry) => entry.item_key),
  );

  return { activity, planComplete };
}
