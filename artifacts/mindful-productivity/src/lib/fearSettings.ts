import supabase from "./supabase";

export interface FearSettingRow {
  id: string;
  user_id: string;
  task_id: string;
  worst_case: string | null;
  prevention_plan: string | null;
  repair_plan: string | null;
  cost_of_inaction: string | null;
  created_at: string;
}

export interface FearSettingInput {
  worstCase: string;
  preventionPlan: string;
  repairPlan: string;
  costOfInaction: string;
}

export async function getFearSetting(
  userId: string,
  taskId: string,
): Promise<FearSettingRow | null> {
  const { data, error } = await supabase
    .from("fear_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as FearSettingRow | null) ?? null;
}

function payload(input: FearSettingInput) {
  return {
    worst_case: input.worstCase.trim() || null,
    prevention_plan: input.preventionPlan.trim() || null,
    repair_plan: input.repairPlan.trim() || null,
    cost_of_inaction: input.costOfInaction.trim() || null,
  };
}

export async function saveFearSetting(
  userId: string,
  taskId: string,
  input: FearSettingInput,
  existingId: string | null,
): Promise<FearSettingRow> {
  if (existingId) {
    const { data, error } = await supabase
      .from("fear_settings")
      .update(payload(input))
      .eq("id", existingId)
      .select()
      .single();
    if (error) throw error;
    return data as FearSettingRow;
  }

  const { data, error } = await supabase
    .from("fear_settings")
    .insert([{ user_id: userId, task_id: taskId, ...payload(input) }])
    .select()
    .single();
  if (error) throw error;
  return data as FearSettingRow;
}
