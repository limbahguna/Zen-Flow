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

/**
 * Updates an entry the signed-in user owns.
 *
 * The owner is read from the live Supabase session rather than taken as an
 * argument, so a caller can never nominate whose row is written. Supabase RLS
 * (auth.uid() = user_id) remains the real authority; the .eq("user_id", ...)
 * filter is defence in depth, matching updateDailyPlanCompletion in
 * wellness/dailyPlans.ts.
 *
 * The payload carries content and mood only. id, user_id and created_at are
 * never written, so ownership and the original timestamp are preserved.
 */
export async function updateJournalEntry(
  entryId: string,
  input: JournalEntryInput,
): Promise<JournalEntryRow> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const userId = auth?.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("journal_entries")
    .update({
      task_id: input.taskId,
      situation: input.situation.trim() || null,
      trigger_thought: input.triggerThought.trim() || null,
      evidence_for: input.evidenceFor.trim() || null,
      evidence_against: input.evidenceAgainst.trim() || null,
      reframed_thought: input.reframedThought.trim() || null,
      mood_before: input.moodBefore,
      mood_after: input.moodAfter,
    })
    .eq("id", entryId)
    .eq("user_id", userId)
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
