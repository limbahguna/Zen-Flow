import supabase from "./supabase";

export type Feeling = "anxious" | "afraid" | "overwhelmed" | "neutral" | "excited" | "calm";

export interface AnxietyCheckInput {
  taskId: string | null;
  feeling: Feeling;
  intensity: number;
  breathingOffered: boolean;
  breathingCompleted: boolean;
}

export interface AnxietyCheckRow {
  id: string;
  user_id: string;
  task_id: string;
  feeling: Feeling;
  intensity: number;
  breathing_offered: boolean;
  breathing_completed: boolean;
  created_at: string;
}

export async function createAnxietyCheck(
  userId: string,
  input: AnxietyCheckInput,
): Promise<AnxietyCheckRow> {
  const { data, error } = await supabase
    .from("anxiety_checks")
    .insert([
      {
        user_id: userId,
        task_id: input.taskId,
        feeling: input.feeling,
        intensity: input.intensity,
        breathing_offered: input.breathingOffered,
        breathing_completed: input.breathingCompleted,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as AnxietyCheckRow;
}

export async function markBreathingCompleted(checkId: string): Promise<void> {
  const { error } = await supabase
    .from("anxiety_checks")
    .update({ breathing_completed: true })
    .eq("id", checkId);

  if (error) throw error;
}

export async function listAnxietyChecks(userId: string): Promise<AnxietyCheckRow[]> {
  const { data, error } = await supabase
    .from("anxiety_checks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AnxietyCheckRow[];
}
