import supabase from "@/lib/supabase";

/**
 * A headline insight as a translation key plus its placeholder values, so the
 * sentence is rendered in the user's language instead of being built in English.
 */
export interface WeeklyInsight {
  key: string;
  values: Record<string, string | number>;
}

export interface WeeklyInsightInput {
  /** anxiety_checks intensity: LOWER is better, so a positive change is relief. */
  moodChange: number | null;
  completionRate: number;
  /** journal mood: HIGHER is better, so a positive average is an improvement. */
  avgMoodImprovement: number | null;
  currentStreak: number;
  breathingSessions: number;
}

/** Pure insight selection, kept separate from Supabase so it can be tested directly. */
export function selectWeeklyInsight(input: WeeklyInsightInput): WeeklyInsight {
  const { moodChange, completionRate, avgMoodImprovement, currentStreak, breathingSessions } = input;

  if (moodChange !== null && moodChange > 0.5) {
    return { key: "weekly.insight.anxietyDown", values: { value: moodChange.toFixed(1) } };
  }
  if (completionRate >= 60) {
    return { key: "weekly.insight.intentions", values: { rate: completionRate } };
  }
  if (avgMoodImprovement !== null && avgMoodImprovement > 1) {
    return { key: "weekly.insight.journalMood", values: { value: avgMoodImprovement.toFixed(1) } };
  }
  if (currentStreak >= 3) {
    return { key: "weekly.insight.streak", values: { count: currentStreak } };
  }
  if (breathingSessions >= 3) {
    return { key: "weekly.insight.breathing", values: { count: breathingSessions } };
  }
  return { key: "weekly.insight.default", values: {} };
}

export interface WeeklyReportData {
  hasEnoughData: boolean;
  weekStart: string;
  weekEnd: string;
  moodAvg: number;
  moodAvgPrevWeek: number | null;
  moodChange: number | null;
  intentionsCreated: number;
  intentionsCompleted: number;
  completionRate: number;
  journalEntries: number;
  avgMoodImprovement: number | null;
  breathingSessions: number;
  currentStreak: number;
  topInsight: WeeklyInsight;
}

export async function getWeeklyReport(userId: string): Promise<WeeklyReportData> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const prevWeekStart = new Date(now);
  prevWeekStart.setDate(now.getDate() - 14);

  const [
    { data: moodChecks },
    { data: prevMoodChecks },
    { data: tasks },
    { data: journalEntries },
    { data: breathingData },
    { data: allActivity },
  ] = await Promise.all([
    supabase
      .from("anxiety_checks")
      .select("intensity, created_at")
      .eq("user_id", userId)
      .gte("created_at", weekStart.toISOString()),

    supabase
      .from("anxiety_checks")
      .select("intensity, created_at")
      .eq("user_id", userId)
      .gte("created_at", prevWeekStart.toISOString())
      .lt("created_at", weekStart.toISOString()),

    supabase
      .from("tasks")
      .select("status, created_at, completed_at")
      .eq("user_id", userId)
      .gte("created_at", weekStart.toISOString()),

    supabase
      .from("journal_entries")
      .select("mood_before, mood_after, created_at")
      .eq("user_id", userId)
      .gte("created_at", weekStart.toISOString()),

    supabase
      .from("anxiety_checks")
      .select("breathing_completed, created_at")
      .eq("user_id", userId)
      .eq("breathing_completed", true)
      .gte("created_at", weekStart.toISOString()),

    supabase
      .from("tasks")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const moodAvg =
    moodChecks && moodChecks.length > 0
      ? moodChecks.reduce((sum, c) => sum + (c.intensity ?? 5), 0) / moodChecks.length
      : 5;

  const moodAvgPrevWeek =
    prevMoodChecks && prevMoodChecks.length > 0
      ? prevMoodChecks.reduce((sum, c) => sum + (c.intensity ?? 5), 0) / prevMoodChecks.length
      : null;

  // lower intensity = better for anxiety → positive moodChange = improvement
  const moodChange = moodAvgPrevWeek !== null ? moodAvgPrevWeek - moodAvg : null;

  const intentionsCreated = tasks?.length ?? 0;
  const intentionsCompleted = tasks?.filter((t) => t.status === "done").length ?? 0;
  const completionRate =
    intentionsCreated > 0 ? Math.round((intentionsCompleted / intentionsCreated) * 100) : 0;

  const journalCount = journalEntries?.length ?? 0;
  const avgMoodImprovement =
    journalEntries && journalEntries.length > 0
      ? journalEntries.reduce(
          (sum, j) => sum + ((j.mood_after ?? 5) - (j.mood_before ?? 5)),
          0,
        ) / journalEntries.length
      : null;

  const breathingSessions = breathingData?.length ?? 0;

  let currentStreak = 0;
  if (allActivity && allActivity.length > 0) {
    const dates = new Set(allActivity.map((a) => new Date(a.created_at).toDateString()));
    const checkDate = new Date();
    while (dates.has(checkDate.toDateString())) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  const topInsight = selectWeeklyInsight({
    moodChange,
    completionRate,
    avgMoodImprovement,
    currentStreak,
    breathingSessions,
  });

  const hasEnoughData =
    (moodChecks?.length ?? 0) + intentionsCreated + journalCount + breathingSessions >= 3;

  return {
    hasEnoughData,
    weekStart: weekStart.toISOString(),
    weekEnd: now.toISOString(),
    moodAvg,
    moodAvgPrevWeek,
    moodChange,
    intentionsCreated,
    intentionsCompleted,
    completionRate,
    journalEntries: journalCount,
    avgMoodImprovement,
    breathingSessions,
    currentStreak,
    topInsight,
  };
}
