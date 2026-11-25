import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAnxietyChecks } from "@/hooks/useAnxietyChecks";
import { useJournal } from "@/hooks/useJournal";
import { useIntentions } from "@/hooks/useIntentions";
import { useLanguage } from "@/context/LanguageContext";
import { listTasks } from "@/lib/tasks";
import { appApiUrl } from "@/lib/apiRuntime";
import supabase from "@/lib/supabase";
import { journalDayKey } from "@/lib/journalStreak";
import { deviceTimeZone, localDateKey, shiftLocalDate } from "@/lib/wellness/localDate";
import { listDailyPlansInRange } from "@/lib/wellness/dailyPlans";
import { listDailyActivityInRange } from "@/lib/wellness/dailyActivity";
import { isDailyPlanComplete } from "@/lib/wellness/dailyPlan";
import { getWellnessPreferences } from "@/lib/wellness/wellnessPreferences";
import {
  assembleStressDay,
  computeDailyStressEstimate,
  hasThreeDayElevated,
  journalSentimentRequestAllowed,
  STRESS_ALGORITHM_VERSION,
  type StressEstimate,
  type StressLevel,
} from "@/lib/stressEstimate";
import {
  listStressEstimatesInRange,
  upsertTodayStressEstimate,
  type StoredStressEstimate,
} from "@/lib/stressEstimates";

const CONSENT_KEY = "kindease_journal_sentiment_consent";
const RANGE_DAYS = 30;

export interface StressDayView {
  localDate: string;
  score: number | null;
  level: StressLevel;
  confidence: StressEstimate["confidence"];
  recommendationKeys: string[];
}

function readLocalConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

function datesEnding(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => shiftLocalDate(today, index - (count - 1)));
}

let lastPersistKey = "";
let lastSentimentKey = "";

export function useStressCheck() {
  const { user, session } = useAuth();
  const { language } = useLanguage();
  const client = useQueryClient();
  const userId = user?.id ?? "";
  const zone = deviceTimeZone();
  const today = localDateKey(zone);
  const start = shiftLocalDate(today, -(RANGE_DAYS - 1));

  const anxiety = useAnxietyChecks();
  const journal = useJournal();
  const intentions = useIntentions();
  const tasks = useQuery({
    queryKey: ["tasks", userId],
    queryFn: () => listTasks(userId),
    enabled: !!userId,
  });
  const sources = useQuery({
    queryKey: ["stress-sources", userId, start, today],
    enabled: !!userId,
    queryFn: async () => {
      const [plans, activity, sleepResult, routineResult, estimates, preferences] = await Promise.all([
        listDailyPlansInRange(userId, start, today),
        listDailyActivityInRange(userId, start, today),
        supabase
          .from("sleep_check_ins")
          .select("sleep_date,sleep_quality,energy_level,feeling")
          .eq("user_id", userId)
          .gte("sleep_date", start)
          .lte("sleep_date", today),
        supabase
          .from("sleep_routine_sessions")
          .select("sleep_date,completed_steps")
          .eq("user_id", userId)
          .gte("sleep_date", start)
          .lte("sleep_date", today),
        listStressEstimatesInRange(userId, start, today).catch(() => [] as StoredStressEstimate[]),
        getWellnessPreferences(userId).catch(() => null),
      ]);
      if (sleepResult.error) throw sleepResult.error;
      if (routineResult.error) throw routineResult.error;
      return {
        plans,
        activity,
        sleep: sleepResult.data ?? [],
        routines: routineResult.data ?? [],
        estimates,
        consent: preferences?.journal_sentiment_consent === true,
      };
    },
  });

  const model = useMemo(() => {
    if (!userId || !sources.data) return null;
    const journalRows = journal.data ?? [];
    const writtenDates = journalRows
      .map((entry) => journalDayKey(entry.created_at, zone))
      .filter(Boolean);
    const completedPlanDates = sources.data.plans
      .filter((plan) => {
        const keys = sources.data!.activity
          .filter((row) => row.daily_plan_id === plan.id)
          .map((row) => row.item_key);
        return plan.completed_at != null || isDailyPlanComplete(plan.items, keys);
      })
      .map((plan) => plan.local_date);

    const days = datesEnding(today, RANGE_DAYS).map((localDate) => {
      const stored = sources.data!.estimates.find(
        (row) => row.local_date === localDate && row.algorithm_version === STRESS_ALGORITHM_VERSION,
      );
      const plan = sources.data!.plans.find((row) => row.local_date === localDate) ?? null;
      const activity = sources.data!.activity.filter((row) => row.local_date === localDate);
      const required = plan?.items.filter((item) => item.required) ?? [];
      const done = new Set(activity.map((row) => row.item_key));
      const moodRow = [...activity].reverse().find((row) => row.mood_score != null);
      const sleep = (sources.data!.sleep as Array<{
        sleep_date: string;
        sleep_quality: number;
        energy_level: number;
        feeling: "rested" | "okay" | "tired" | "restless";
      }>).find((row) => row.sleep_date === localDate);
      const routine = (sources.data!.routines as Array<{ sleep_date: string; completed_steps: string[] | null }>)
        .find((row) => row.sleep_date === localDate);

      const estimate = computeDailyStressEstimate(assembleStressDay(localDate, {
        timeZone: zone,
        anxietyChecks: (anxiety.data ?? []).map((row) => ({
          createdAt: row.created_at,
          intensity: row.intensity,
          feeling: row.feeling,
          breathingOffered: row.breathing_offered,
          breathingCompleted: row.breathing_completed,
        })),
        journalEntries: journalRows.map((row) => ({
          createdAt: row.created_at,
          moodBefore: row.mood_before,
          moodAfter: row.mood_after,
          situation: row.situation,
          trigger: row.trigger_thought,
          reframe: row.reframed_thought,
        })),
        dailyPlanMood: moodRow?.mood_score ?? null,
        sleep: sleep
          ? {
              quality: sleep.sleep_quality,
              energy: sleep.energy_level,
              feeling: sleep.feeling,
              routineCompleted: (routine?.completed_steps?.length ?? 0) > 0,
            }
          : null,
        plan: plan
          ? { requiredCount: required.length, missedRequired: required.filter((item) => !done.has(item.item_key)).length }
          : null,
        intentions: (intentions.data ?? []).map((item) => ({
          createdAt: item.created_at,
          status: item.status,
          frequency: item.frequency,
          selectedDays: item.selected_days ?? [],
          completedAt: item.completed_at,
        })),
        tasks: (tasks.data ?? []).map((task) => ({
          createdAt: task.created_at,
          status: task.status,
          postponeCount: task.postpone_count ?? 0,
        })),
        planCompletedDates: completedPlanDates,
        journalWrittenDates: writtenDates,
        journalSentiment: stored?.journal_sentiment ?? null,
      }));

      const useStored = localDate !== today && stored && estimate.score == null;
      return {
        localDate,
        score: useStored ? stored.score : estimate.score,
        level: useStored ? stored.level : estimate.level,
        confidence: useStored ? stored.confidence : estimate.confidence,
        recommendationKeys: estimate.recommendationKeys,
        estimate,
        sentiment: stored?.journal_sentiment ?? null,
      };
    });

    const todayView = days[days.length - 1]!;
    return { days, todayView, writtenDates };
  }, [userId, sources.data, journal.data, anxiety.data, intentions.data, tasks.data, today, zone]);

  useEffect(() => {
    if (!userId || !model) return;
    const persistable = model.days.filter(
      (day) => day.estimate.score != null && day.estimate.level !== "unknown" && day.estimate.confidence !== "none",
    );
    const key = `${userId}:${persistable.map((day) => `${day.localDate}:${day.score}`).join(",")}`;
    if (key === lastPersistKey) return;
    lastPersistKey = key;
    void Promise.all(
      persistable.map((day) => upsertTodayStressEstimate(
        userId,
        day.localDate,
        day.estimate as StressEstimate & { score: number; level: Exclude<StressLevel, "unknown">; confidence: "low" | "medium" | "high" },
        day.sentiment,
      ).catch(() => undefined)),
    );
  }, [userId, model]);

  const consent = sources.data?.consent === true || readLocalConsent();
  const todayJournal = (journal.data ?? []).filter((entry) => journalDayKey(entry.created_at, zone) === today);
  const latestJournal = todayJournal[todayJournal.length - 1];
  const cachedSentiment = model?.todayView.sentiment ?? null;

  useEffect(() => {
    if (!userId || !session?.access_token || !latestJournal) return;
    if (!journalSentimentRequestAllowed(consent, cachedSentiment)) return;
    const key = `${userId}:${today}:${latestJournal.id}`;
    if (lastSentimentKey === key) return;
    lastSentimentKey = key;
    void (async () => {
      try {
        const response = await fetch(appApiUrl("/api/ai/journal-sentiment"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            language,
            situation: latestJournal.situation ?? "",
            trigger: latestJournal.trigger_thought ?? "",
            reframe: latestJournal.reframed_thought ?? "",
          }),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { distress?: number };
        if (typeof payload.distress !== "number" || !model?.todayView.estimate.score) return;
        await upsertTodayStressEstimate(
          userId,
          today,
          model.todayView.estimate as StressEstimate & { score: number; level: Exclude<StressLevel, "unknown">; confidence: "low" | "medium" | "high" },
          payload.distress,
        );
        await client.invalidateQueries({ queryKey: ["stress-sources", userId] });
      } catch {
        // A failed tone estimate is skipped. The score stands without it.
      }
    })();
  }, [userId, session?.access_token, consent, cachedSentiment, latestJournal, today, language, model, client]);

  const views: StressDayView[] = (model?.days ?? []).map(({ localDate, score, level, confidence, recommendationKeys }) => ({
    localDate,
    score,
    level,
    confidence,
    recommendationKeys,
  }));
  const isLoading = !!userId && (sources.isLoading || anxiety.isLoading || journal.isLoading);
  const isError = sources.isError || anxiety.isError || journal.isError;

  return {
    isLoading,
    isError,
    retry: () => {
      void sources.refetch();
      void anxiety.refetch();
      void journal.refetch();
    },
    today: views[views.length - 1] ?? null,
    days: views,
    threeDayElevated: hasThreeDayElevated(views, today),
    consent,
  };
}

export async function saveJournalSentimentConsent(userId: string, consent: boolean): Promise<void> {
  try {
    localStorage.setItem(CONSENT_KEY, consent ? "1" : "0");
  } catch {
    // Preference storage can fail in private mode; the server column remains the source of truth.
  }
  const { error } = await supabase
    .from("user_wellness_preferences")
    .update({ journal_sentiment_consent: consent })
    .eq("user_id", userId);
  if (error) throw error;
}
