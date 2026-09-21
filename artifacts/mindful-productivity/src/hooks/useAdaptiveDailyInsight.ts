import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { useLessons } from "@/hooks/useLessons";
import {
  useActiveWellnessEnrollment,
  useWellnessPreferences,
} from "@/hooks/useWellnessProgram";
import { getDailyPlanForDate, planLocalDate } from "@/lib/wellness/dailyPlans";
import { logSanitizedWellnessError } from "@/lib/wellness/errors";
import { loadAdaptiveInsightSignals } from "@/lib/wellness/insightHistory";
import {
  selectAdaptiveDailyInsight,
  type AdaptiveInsightResult,
} from "@/lib/wellness/dailyInsightSelection";
import { isProgramSlug } from "@/lib/wellness/types";

export const adaptiveInsightQueryKeys = {
  todayPlan: (userId: string, localDate: string) =>
    ["wellness-daily-plan-readonly", userId, localDate] as const,
  signals: (userId: string, localDate: string) =>
    ["adaptive-insight-signals", userId, localDate] as const,
};

export function useAdaptiveDailyInsight(): AdaptiveInsightResult & {
  localDate: string;
  todayPlanId: string | null;
  programSlug: string | null;
  primaryGoal: string | null;
} {
  const { user } = useAuth();
  const { language } = useLanguage();
  const userId = user?.id;
  const prefsQuery = useWellnessPreferences();
  const enrollmentQuery = useActiveWellnessEnrollment();
  const lessonsQuery = useLessons();
  const timezone = prefsQuery.data?.timezone ?? null;
  const localDate = planLocalDate(timezone ?? "UTC");
  const programSlug =
    enrollmentQuery.data && isProgramSlug(enrollmentQuery.data.program_slug)
      ? enrollmentQuery.data.program_slug
      : null;

  const todayPlanQuery = useQuery({
    queryKey: adaptiveInsightQueryKeys.todayPlan(userId ?? "", localDate),
    enabled: Boolean(userId),
    queryFn: async () => {
      try {
        return await getDailyPlanForDate(userId!, localDate);
      } catch (error) {
        logSanitizedWellnessError(error);
        return null;
      }
    },
  });

  const signalsQuery = useQuery({
    queryKey: adaptiveInsightQueryKeys.signals(userId ?? "", localDate),
    enabled: Boolean(userId),
    queryFn: () => loadAdaptiveInsightSignals(userId!, localDate, timezone),
  });

  const selection = selectAdaptiveDailyInsight({
    lessons: lessonsQuery.data ?? [],
    localDate,
    locale: language,
    primaryGoal: prefsQuery.data?.primary_goal ?? null,
    programSlug,
    programDay: enrollmentQuery.data?.current_day ?? null,
    existingLessonId: todayPlanQuery.data?.lesson_id ?? null,
    progress: signalsQuery.data?.progress ?? [],
    insightReads: signalsQuery.data?.insightReads ?? [],
    historyUnavailable: Boolean(signalsQuery.data?.failed),
    localeFallback: language !== "en",
  });

  return {
    ...selection,
    localDate,
    todayPlanId: todayPlanQuery.data?.id ?? null,
    programSlug,
    primaryGoal: prefsQuery.data?.primary_goal ?? null,
  };
}
