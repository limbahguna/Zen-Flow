import { listLessonProgress } from "../lessons";
import { listDailyActivityInRange } from "./dailyActivity";
import { listDailyPlansInRange } from "./dailyPlans";
import { logSanitizedWellnessError } from "./errors";
import { sevenLocalDateRange } from "./localDate";
import { planLocalDate } from "./dailyPlans";
import type { InsightReadSignal, LessonProgressSignal } from "./dailyInsightSelection";

async function safeRead<T>(run: () => Promise<T>, fallback: T): Promise<{ data: T; failed: boolean }> {
  try {
    return { data: await run(), failed: false };
  } catch (error) {
    logSanitizedWellnessError(error);
    return { data: fallback, failed: true };
  }
}

export interface AdaptiveInsightSignals {
  progress: LessonProgressSignal[];
  insightReads: InsightReadSignal[];
  failed: boolean;
}

export async function loadAdaptiveInsightSignals(
  userId: string,
  localDate: string,
  timezone: string | null,
): Promise<AdaptiveInsightSignals> {
  const range = sevenLocalDateRange(localDate);
  const [progressResult, plansResult, activityResult] = await Promise.all([
    safeRead(() => listLessonProgress(userId), []),
    safeRead(() => listDailyPlansInRange(userId, range.start, range.end), []),
    safeRead(() => listDailyActivityInRange(userId, range.start, range.end), []),
  ]);

  const progress: LessonProgressSignal[] = progressResult.data.map((row) => ({
    lessonId: row.lesson_id,
    readAt: row.read_at,
    helpful: row.helpful,
    localDate: timezone ? planLocalDate(timezone, new Date(row.read_at)) : undefined,
  }));

  const completedPlanIds = new Set(
    activityResult.data
      .filter((row) => row.item_key === "daily_insight")
      .map((row) => row.daily_plan_id),
  );
  const insightReads: InsightReadSignal[] = plansResult.data
    .filter((plan) => Boolean(plan.lesson_id) && completedPlanIds.has(plan.id))
    .map((plan) => ({ lessonId: plan.lesson_id as string, localDate: plan.local_date }));

  return {
    progress,
    insightReads,
    failed: progressResult.failed || plansResult.failed || activityResult.failed,
  };
}
