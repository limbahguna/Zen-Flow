import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  useActiveWellnessEnrollment,
  useWellnessPreferences,
  wellnessQueryKeys,
} from "@/hooks/useWellnessProgram";
import { listDailyActivityInRange } from "@/lib/wellness/dailyActivity";
import { listDailyPlansInRange } from "@/lib/wellness/dailyPlans";
import { planLocalDate } from "@/lib/wellness/dailyPlans";
import { featuredEnrollment, listRecentEnrollments } from "@/lib/wellness/programEnrollments";
import { sevenLocalDateRange } from "@/lib/wellness/localDate";
import { aggregateWeeklyProgress } from "@/lib/wellness/weeklyProgress";

export const progressQueryKeys = {
  ...wellnessQueryKeys,
  enrollments: (userId: string) => ["wellness-enrollments", userId] as const,
  plansRange: (userId: string, start: string, end: string) =>
    ["wellness-daily-plans-range", userId, start, end] as const,
  activityRange: (userId: string, start: string, end: string) =>
    ["wellness-daily-activity-range", userId, start, end] as const,
};

export function useProgressReport() {
  const { user } = useAuth();
  const userId = user?.id;
  const prefsQuery = useWellnessPreferences();
  const activeEnrollmentQuery = useActiveWellnessEnrollment();
  const enrollmentsQuery = useQuery({
    queryKey: progressQueryKeys.enrollments(userId ?? ""),
    enabled: Boolean(userId),
    queryFn: () => listRecentEnrollments(userId!),
  });

  const timezone = prefsQuery.data?.timezone ?? null;
  const today = timezone ? planLocalDate(timezone) : null;
  const range = today ? sevenLocalDateRange(today) : null;

  const plansQuery = useQuery({
    queryKey: progressQueryKeys.plansRange(userId ?? "", range?.start ?? "", range?.end ?? ""),
    enabled: Boolean(userId && range),
    queryFn: () => listDailyPlansInRange(userId!, range!.start, range!.end),
  });

  const activityQuery = useQuery({
    queryKey: progressQueryKeys.activityRange(userId ?? "", range?.start ?? "", range?.end ?? ""),
    enabled: Boolean(userId && range),
    queryFn: () => listDailyActivityInRange(userId!, range!.start, range!.end),
  });

  const enrollment =
    featuredEnrollment(enrollmentsQuery.data ?? []) ?? activeEnrollmentQuery.data ?? null;

  const report =
    today && plansQuery.isSuccess && activityQuery.isSuccess
      ? aggregateWeeklyProgress({
          today,
          plans: plansQuery.data ?? [],
          activities: activityQuery.data ?? [],
          enrollment,
        })
      : null;

  const isLoading =
    Boolean(userId) &&
    (prefsQuery.isLoading ||
      enrollmentsQuery.isLoading ||
      (range != null && (plansQuery.isLoading || activityQuery.isLoading)));

  const isError =
    prefsQuery.isError || enrollmentsQuery.isError || plansQuery.isError || activityQuery.isError;

  function retry() {
    void prefsQuery.refetch();
    void enrollmentsQuery.refetch();
    void activeEnrollmentQuery.refetch();
    void plansQuery.refetch();
    void activityQuery.refetch();
  }

  return {
    userId,
    today,
    range,
    prefsQuery,
    enrollmentsQuery,
    plansQuery,
    activityQuery,
    enrollment,
    report,
    isLoading,
    isError,
    retry,
  };
}
