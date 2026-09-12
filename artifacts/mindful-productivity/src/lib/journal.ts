import supabase from "./supabase";

export interface JournalEntryRow {
  id: string;
  user_id: string;
  task_id: string | null;
  situation: string | null;
  trigger_thought: string | null;
  evidence_for: string | null;
  evidence_against: string | null;
  reframed_thought: string | null;
  mood_before: number | null;
  mood_after: number | null;
  tags: string[] | null;
  created_at: string;
}

export interface JournalEntryInput {
  taskId: string | null;
  situation: string;
  triggerThought: string;
  evidenceFor: string;
  evidenceAgainst: string;
  reframedThought: string;
  moodBefore: number;
  moodAfter: number;
}

export async function createJournalEntry(
  userId: string,
  input: JournalEntryInput,
): Promise<JournalEntryRow> {
  const { data, error } = await supabase
    .from("journal_entries")
    .insert([
      {
        user_id: userId,
        task_id: input.taskId,
        situation: input.situation.trim() || null,
        trigger_thought: input.triggerThought.trim() || null,
        evidence_for: input.evidenceFor.trim() || null,
        evidence_against: input.evidenceAgainst.trim() || null,
        reframed_thought: input.reframedThought.trim() || null,
        mood_before: input.moodBefore,
        mood_after: input.moodAfter,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as JournalEntryRow;
}

export async function listJournalEntries(userId: string): Promise<JournalEntryRow[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as JournalEntryRow[];
}
