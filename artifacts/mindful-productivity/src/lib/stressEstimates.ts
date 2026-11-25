import supabase from "./supabase";
import type { StressConfidence, StressEstimate, StressLevel } from "./stressEstimate";
import { STRESS_ALGORITHM_VERSION } from "./stressEstimate";

export interface StoredStressEstimate {
  id: string;
  user_id: string;
  local_date: string;
  score: number;
  level: Exclude<StressLevel, "unknown">;
  confidence: Exclude<StressConfidence, "none">;
  components: StressEstimate["components"];
  journal_sentiment: number | null;
  algorithm_version: number;
}

export async function listStressEstimatesInRange(
  userId: string,
  start: string,
  end: string,
): Promise<StoredStressEstimate[]> {
  const { data, error } = await supabase
    .from("user_stress_estimates")
    .select("*")
    .eq("user_id", userId)
    .gte("local_date", start)
    .lte("local_date", end)
    .order("local_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as StoredStressEstimate[];
}

export async function upsertTodayStressEstimate(
  userId: string,
  localDate: string,
  estimate: StressEstimate & { score: number; level: Exclude<StressLevel, "unknown">; confidence: Exclude<StressConfidence, "none"> },
  journalSentiment: number | null,
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId,
    local_date: localDate,
    score: estimate.score,
    level: estimate.level,
    confidence: estimate.confidence,
    components: estimate.components,
    algorithm_version: STRESS_ALGORITHM_VERSION,
  };
  // Omit a null sentiment so a later score refresh does not wipe a cached tone estimate.
  if (journalSentiment != null) row.journal_sentiment = journalSentiment;
  const { error } = await supabase
    .from("user_stress_estimates")
    .upsert(row, { onConflict: "user_id,local_date" });
  if (error) throw error;
}
