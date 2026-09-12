import supabase from "./supabase";
import { trackEvent } from "./analytics";

export interface TaskRow {
  id: string;
  title: string;
  wish: string | null;
  outcome: string | null;
  obstacle: string | null;
  plan_if_then: string | null;
  user_id: string;
  status: string;
  postpone_count: number | null;
  original_title: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface WoopInput {
  wish: string;
  outcome: string;
  obstacle: string;
  plan: string;
}

export async function createWoopTask(userId: string, input: WoopInput): Promise<TaskRow> {
  const wish = input.wish.trim();

  const { data, error } = await supabase
    .from("tasks")
    .insert([
      {
        title: wish.slice(0, 100),
        wish,
        outcome: input.outcome.trim(),
        obstacle: input.obstacle.trim(),
        plan_if_then: input.plan.trim(),
        user_id: userId,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as TaskRow;
}

export async function listTasks(userId: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

export async function startTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "in_progress" })
    .eq("id", taskId);

  if (error) throw error;
}

export async function completeTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) throw error;
  trackEvent("task_completed", { workflow: "woop" });
}

// Calls the existing Supabase RPC which increments postpone_count and preserves
// original_title, then re-reads the row to return the new count so the caller can
// decide whether to trigger the Friction Reducer.
export async function postponeTask(taskId: string): Promise<number> {
  const { error } = await supabase.rpc("postpone_task", { p_task_id: taskId });
  if (error) throw error;

  const { data, error: readError } = await supabase
    .from("tasks")
    .select("postpone_count")
    .eq("id", taskId)
    .single();

  if (readError) throw readError;
  return (data?.postpone_count as number | null) ?? 0;
}

export async function abandonTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "abandoned" })
    .eq("id", taskId);
  if (error) throw error;
}

// Shrinks a task to a smaller, less intimidating version. original_title is already
// preserved by the postpone_task RPC, but set it defensively if it is still empty.
export async function shrinkTask(
  taskId: string,
  newTitle: string,
  originalTitle: string,
): Promise<void> {
  const update: Record<string, string> = { title: newTitle.trim() };
  if (originalTitle) update.original_title = originalTitle;

  const { error } = await supabase.from("tasks").update(update).eq("id", taskId);
  if (error) throw error;
}
