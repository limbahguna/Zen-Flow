import supabase from "./supabase";

export type IntentionStatus = "active" | "done" | "postponed" | "let_go";
export type ReminderChoice = "off" | "morning" | "evening" | "custom";
export type IntentionFrequency = "once" | "daily" | "selected_days";

export interface Intention {
  id: string;
  user_id: string;
  title: string;
  why_it_matters: string | null;
  small_action: string;
  status: IntentionStatus;
  reminder_choice: ReminderChoice;
  reminder_time: string | null;
  frequency: IntentionFrequency;
  selected_days: number[];
  timezone: string;
  postponed_until: string | null;
  completed_at: string | null;
  let_go_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntentionInput {
  title: string;
  why_it_matters?: string;
  small_action: string;
  reminder_choice: ReminderChoice;
  reminder_time: string | null;
  frequency: IntentionFrequency;
  selected_days: number[];
  timezone: string;
}

function cleanInput(input: IntentionInput) {
  return {
    title: input.title.trim(),
    why_it_matters: input.why_it_matters?.trim() || null,
    small_action: input.small_action.trim(),
    reminder_choice: input.reminder_choice,
    reminder_time: input.reminder_choice === "off" ? null : input.reminder_time,
    frequency: input.frequency,
    selected_days: input.frequency === "selected_days" ? input.selected_days : [],
    timezone: input.timezone,
  };
}

export async function listIntentions(): Promise<Intention[]> {
  const { data, error } = await supabase
    .from("intentions")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Intention[];
}

export async function createIntention(input: IntentionInput): Promise<Intention> {
  const { data, error } = await supabase
    .from("intentions")
    .insert(cleanInput(input))
    .select()
    .single();
  if (error) throw error;
  return data as Intention;
}

export async function updateIntention(id: string, input: IntentionInput): Promise<Intention> {
  const { data, error } = await supabase
    .from("intentions")
    .update(cleanInput(input))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Intention;
}

export async function updateIntentionStatus(
  id: string,
  status: IntentionStatus,
  postponedUntil: string | null = null,
): Promise<Intention> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("intentions")
    .update({
      status,
      postponed_until: status === "postponed" ? postponedUntil : null,
      completed_at: status === "done" ? now : null,
      let_go_at: status === "let_go" ? now : null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Intention;
}