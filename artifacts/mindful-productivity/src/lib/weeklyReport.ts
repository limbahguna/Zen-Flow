import supabase from "@/lib/supabase";

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
  topInsight: string;
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

  let topInsight = "";
  if (moodChange !== null && moodChange > 0.5) {
    topInsight = `Your anxiety dropped by ${moodChange.toFixed(1)} points this week. Whatever you're doing, it's working.`;
  } else if (completionRate >= 60) {
    topInsight = `You completed ${completionRate}% of your intentions this week. That's real follow-through.`;
  } else if (avgMoodImprovement !== null && avgMoodImprovement > 1) {
    topInsight = `Your journal entries show your mood improves by ${avgMoodImprovement.toFixed(1)} points after reframing. CBT is working for you.`;
  } else if (currentStreak >= 3) {
    topInsight = `${currentStreak} days in a row. You're building a real habit.`;
  } else if (breathingSessions >= 3) {
    topInsight = `${breathingSessions} breathing sessions this week. Each one is a small act of self-care.`;
  } else {
    topInsight = "Every check-in counts. Keep showing up for yourself.";
  }

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
