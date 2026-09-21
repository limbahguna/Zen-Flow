import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLessons } from "@/hooks/useLessons";
import { useLanguage } from "@/context/LanguageContext";
import { completeDailyPlanItem, listDailyActivity } from "@/lib/wellness/dailyActivity";
import { isDailyPlanComplete } from "@/lib/wellness/dailyPlan";
import { selectAdaptiveDailyInsight } from "@/lib/wellness/dailyInsightSelection";
import { loadAdaptiveInsightSignals } from "@/lib/wellness/insightHistory";
import {
  completeWellnessDailyPlan,
  getDailyPlanForDate,
  loadOrCreateDailyPlan,
  planLocalDate,
} from "@/lib/wellness/dailyPlans";
import type { DailyActivity, DailyActivityInput, DailyPlanItemKey } from "@/lib/wellness/types";
import {
  useActiveWellnessEnrollment,
  useWellnessPreferences,
  wellnessQueryKeys,
} from "@/hooks/useWellnessProgram";

export { wellnessQueryKeys };

function extendWellnessKeys() {
  return {
    ...wellnessQueryKeys,
    dailyPlan: (userId: string, localDate: string) =>
      ["wellness-daily-plan", userId, localDate] as const,
    dailyActivity: (userId: string, planId: string) =>
      ["wellness-daily-activity", userId, planId] as const,
  };
}

export const dailyPlanQueryKeys = extendWellnessKeys();

export function useDailyPlanSession() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const userId = user?.id;
  const prefsQuery = useWellnessPreferences();
  const enrollmentQuery = useActiveWellnessEnrollment();
  const lessonsQuery = useLessons();
  const client = useQueryClient();

  const localDate = prefsQuery.data ? planLocalDate(prefsQuery.data.timezone) : null;

  const planQuery = useQuery({
    queryKey: dailyPlanQueryKeys.dailyPlan(userId ?? "", localDate ?? ""),
    enabled: Boolean(
      userId &&
        localDate &&
        prefsQuery.isSuccess &&
        prefsQuery.data &&
        enrollmentQuery.isSuccess &&
        lessonsQuery.isSuccess,
    ),
    queryFn: async () => {
      if (!userId || !localDate || !prefsQuery.data) {
        throw new Error("Authentication required");
      }
      const enrollment = enrollmentQuery.data ?? null;
      if (!enrollment) {
        return getDailyPlanForDate(userId, localDate);
      }
      const existing = await getDailyPlanForDate(userId, localDate);
      if (existing) return existing;
      const signals = await loadAdaptiveInsightSignals(
        userId,
        localDate,
        prefsQuery.data.timezone,
      );
      const selected = selectAdaptiveDailyInsight({
        lessons: lessonsQuery.data ?? [],
        localDate,
        locale: language,
        primaryGoal: prefsQuery.data.primary_goal,
        programSlug: enrollment.program_slug,
        programDay: enrollment.current_day,
        existingLessonId: null,
        progress: signals.progress,
        insightReads: signals.insightReads,
        historyUnavailable: signals.failed,
        localeFallback: language !== "en",
      });
      return loadOrCreateDailyPlan({
        userId,
        localDate,
        primaryGoal: prefsQuery.data.primary_goal,
        preferredDurationMinutes: prefsQuery.data.preferred_duration_minutes,
        selectedLessonId: selected.lessonId,
        enrollment,
      });
    },
  });

  const planId = planQuery.data?.id ?? null;

  const activityQuery = useQuery({
    queryKey: dailyPlanQueryKeys.dailyActivity(userId ?? "", planId ?? ""),
    enabled: Boolean(userId && planId),
    queryFn: () => listDailyActivity(userId!, planId!),
  });

  async function invalidatePlanSurfaces() {
    if (!userId) return;
    await Promise.all([
      client.invalidateQueries({ queryKey: dailyPlanQueryKeys.enrollment(userId) }),
      client.invalidateQueries({ queryKey: dailyPlanQueryKeys.preferences(userId) }),
      client.invalidateQueries({ queryKey: ["wellness-enrollments", userId] }),
      client.invalidateQueries({ queryKey: ["wellness-daily-plans-range", userId] }),
      client.invalidateQueries({ queryKey: ["wellness-daily-activity-range", userId] }),
      localDate
        ? client.invalidateQueries({ queryKey: dailyPlanQueryKeys.dailyPlan(userId, localDate) })
        : Promise.resolve(),
      planId
        ? client.invalidateQueries({ queryKey: dailyPlanQueryKeys.dailyActivity(userId, planId) })
        : Promise.resolve(),
    ]);
  }

  const completeItem = useMutation({
    mutationFn: async (input: DailyActivityInput) => {
      if (!userId || !planQuery.data) throw new Error("Authentication required");
      return completeDailyPlanItem(userId, input, planQuery.data.items);
    },
    onSuccess: async () => {
      if (userId && planId) {
        await client.invalidateQueries({
          queryKey: dailyPlanQueryKeys.dailyActivity(userId, planId),
        });
      }
    },
  });

  const completePlan = useMutation({
    mutationFn: async (id: string) => completeWellnessDailyPlan(id),
    onSuccess: () => invalidatePlanSurfaces(),
  });

  const completedKeys = new Set((activityQuery.data ?? []).map((row) => row.item_key));
  const requiredComplete =
    planQuery.data != null && isDailyPlanComplete(planQuery.data.items, completedKeys);

  return {
    userId,
    localDate,
    prefsQuery,
    enrollmentQuery,
    lessonsQuery,
    planQuery,
    activityQuery,
    completeItem,
    completePlan,
    completedKeys,
    requiredComplete,
    invalidatePlanSurfaces,
    language,
  };
}

export function activityForKey(
  activities: DailyActivity[] | undefined,
  key: DailyPlanItemKey,
): DailyActivity | null {
  return activities?.find((row) => row.item_key === key) ?? null;
}
