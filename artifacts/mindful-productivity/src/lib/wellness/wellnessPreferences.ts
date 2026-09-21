import supabase from "../supabase";
import type { WellnessPreferences, WellnessPreferencesInput } from "./types";

export async function getWellnessPreferences(
  userId: string,
): Promise<WellnessPreferences | null> {
  const { data, error } = await supabase
    .from("user_wellness_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as WellnessPreferences | null) ?? null;
}

export async function saveWellnessPreferences(
  userId: string,
  input: WellnessPreferencesInput,
): Promise<WellnessPreferences> {
  const { data: inserted, error: insertError } = await supabase
    .from("user_wellness_preferences")
    .insert(input)
    .select()
    .maybeSingle();

  if (!insertError && inserted) {
    return inserted as WellnessPreferences;
  }

  const isConflict =
    insertError?.code === "23505" ||
    /duplicate key/i.test(insertError?.message ?? "");
  if (!isConflict) throw insertError;

  const { data: updated, error: updateError } = await supabase
    .from("user_wellness_preferences")
    .update(input)
    .eq("user_id", userId)
    .select()
    .single();
  if (updateError) throw updateError;
  return updated as WellnessPreferences;
}
