import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/BottomNav";
import { BreathingModal } from "@/components/BreathingModal";
import { LessonReader } from "@/components/LessonReader";
import { MovementSession } from "@/components/MovementSession";
import {
  DailyInsightItem,
  MoodCheckInItem,
  PracticeItem,
  ReflectionItem,
} from "@/components/daily-plan/DailyPlanItems";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { activityForKey, useDailyPlanSession } from "@/hooks/useDailyPlan";
import { t as translate } from "@/lib/translations";
import { isDailyPlanComplete, requiredItemKeys } from "@/lib/wellness/dailyPlan";
import {
  dailyInsightReasonCopy,
  resolveDailyInsightLesson,
  selectAdaptiveDailyInsight,
} from "@/lib/wellness/dailyInsightSelection";
import { getProgram } from "@/lib/wellness/programCatalog";
import type { DailyPlanItem, PracticeKind } from "@/lib/wellness/types";
import { isProgramSlug } from "@/lib/wellness/types";

export default function DailyPlanPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const session = useDailyPlanSession();
  const [lessonOpen, setLessonOpen] = useState(false);
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const rpcAttempted = useRef<string | null>(null);

  const plan = session.planQuery.data ?? null;
  const enrollment = session.enrollmentQuery.data ?? null;
  const activities = session.activityQuery.data ?? [];
  const lessons = session.lessonsQuery.data ?? [];
  const slug = plan && isProgramSlug(plan.program_slug) ? plan.program_slug : null;
  const program = slug ? getProgram(slug) : null;
  const required = plan ? requiredItemKeys(plan.items) : [];
  const doneRequired = required.filter((key) => session.completedKeys.has(key)).length;
  const totalMinutes = plan?.items.reduce((sum, item) => sum + (item.planned_minutes ?? 0), 0) ?? 0;
  const progress = required.length ? Math.min(100, (doneRequired / required.length) * 100) : 0;
  const insight = resolveDailyInsightLesson(lessons, plan?.lesson_id ?? null);
  const insightReason = selectAdaptiveDailyInsight({
    lessons,
    localDate: session.localDate ?? plan?.local_date ?? "",
    locale: language,
    primaryGoal: session.prefsQuery.data?.primary_goal ?? null,
    programSlug: enrollment?.program_slug ?? plan?.program_slug,
    programDay: enrollment?.current_day ?? plan?.program_day,
    existingLessonId: plan?.lesson_id ?? null,
    localeFallback: language !== "en",
  });
  const insightReasonText = dailyInsightReasonCopy(language, insightReason.reasonKey, {
    program: program ? t(program.titleKey) : undefined,
    goal: session.prefsQuery.data
      ? t(`programs.goal.${session.prefsQuery.data.primary_goal}`)
      : undefined,
  });
  const planCompleteOnServer = Boolean(plan?.completed_at);
  const allRequiredDone = plan ? isDailyPlanComplete(plan.items, session.completedKeys) : false;

  const completion = session.completePlan.data;
  const dayLabel = useMemo(() => {
    if (!plan?.program_day || !program) return null;
    return translate(language, "programs.active.dayOf", {
      day: plan.program_day,
      total: program.durationDays,
    });
  }, [language, plan?.program_day, program]);

  useEffect(() => {
    if (!plan || plan.completed_at || !allRequiredDone) return;
    if (session.completePlan.isPending || session.completeItem.isPending) return;
    if (rpcAttempted.current === plan.id) return;
    rpcAttempted.current = plan.id;
    session.completePlan.mutate(plan.id, {
      onError: () => {
        rpcAttempted.current = null;
        toast({ title: t("dailyPlan.error.complete"), variant: "destructive" });
      },
    });
  }, [allRequiredDone, plan, session.completeItem.isPending, session.completePlan, t, toast]);

  function saveItem(
    item: DailyPlanItem,
    extra: { mood_score?: number; reflection_text?: string | null; duration_minutes?: number },
  ) {
    if (!plan || savingKey) return;
    setSavingKey(item.item_key);
    session.completeItem.mutate(
      {
        daily_plan_id: plan.id,
        local_date: plan.local_date,
        item_key: item.item_key,
        item_type: item.item_type,
        practice_kind: item.item_key === "program_practice" ? item.practice_kind : null,
        mood_score: extra.mood_score,
        reflection_text: extra.reflection_text,
        duration_minutes: extra.duration_minutes,
      },
      {
        onError: () => toast({ title: t("dailyPlan.error.save"), variant: "destructive" }),
        onSettled: () => setSavingKey(null),
      },
    );
  }

  function openPractice(kind: PracticeKind) {
    if (kind === "breathing" || kind === "relaxation") {
      setBreathingOpen(true);
      return;
    }
    if (kind === "movement") {
      setMovementOpen(true);
      return;
    }
    if (kind === "focus_timer") {
      setLocation("/focus?from=daily-plan");
      return;
    }
    if (kind === "sleep_routine") {
      setLocation("/sleep?from=daily-plan");
    }
  }

  const busy = session.completeItem.isPending || session.completePlan.isPending;

  return (
    <motion.div
      className="min-h-screen bg-background pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <header className="sticky top-0 z-10 border-b border-[#2D3A2E] bg-[#141814]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => setLocation("/dashboard")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A3B197] hover:bg-[#222822]"
            aria-label={t("dailyPlan.back")}
            data-testid="daily-plan-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("dailyPlan.title")}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-8">
        {!user && (
          <div className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center text-sm text-[#D4806A]" role="alert" data-testid="daily-plan-auth-error">
            {t("dailyPlan.error.auth")}
          </div>
        )}

        {user && session.prefsQuery.isSuccess && !session.prefsQuery.data && (
          <section className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5 text-center" data-testid="daily-plan-missing-prefs">
            <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("dailyPlan.prefs.title")}</h2>
            <p className="mt-2 text-sm text-[#A3B197]">{t("dailyPlan.prefs.body")}</p>
            <button type="button" className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#4A5D3E] px-4 text-sm text-[#E8EDE3]" onClick={() => setLocation("/programs")}>
              {t("dailyPlan.prefs.cta")}
            </button>
          </section>
        )}

        {user && session.enrollmentQuery.isSuccess && !enrollment && !plan && session.prefsQuery.data && (
          <section className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5 text-center" data-testid="daily-plan-empty">
            <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("dailyPlan.empty.title")}</h2>
            <p className="mt-2 text-sm text-[#A3B197]">{t("dailyPlan.empty.body")}</p>
            <a
              href="/programs"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#4A5D3E] px-4 text-sm text-[#E8EDE3]"
              data-testid="daily-plan-empty-cta"
              onClick={(event) => {
                event.preventDefault();
                setLocation("/programs");
              }}
            >
              {t("dailyPlan.empty.cta")}
            </a>
          </section>
        )}

        {user && (session.planQuery.isLoading || session.prefsQuery.isLoading || session.enrollmentQuery.isLoading) && (
          <div className="flex justify-center py-10" data-testid="daily-plan-loading">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8FA680] border-t-transparent" />
            <span className="sr-only">{t("dailyPlan.loading")}</span>
          </div>
        )}

        {user && (session.planQuery.isError || session.activityQuery.isError) && (
          <div className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center" role="alert" data-testid="daily-plan-error">
            <p className="text-sm text-[#D4806A]">{t("dailyPlan.error.network")}</p>
            <button type="button" className="mt-2 text-sm text-[#C8D5B9]" onClick={() => { void session.planQuery.refetch(); void session.activityQuery.refetch(); }} data-testid="daily-plan-retry">
              {t("dailyPlan.error.retry")}
            </button>
          </div>
        )}

        {plan && (
          <>
            <section data-testid="daily-plan-header">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("dailyPlan.subtitle")}</p>
              {program && (
                <h2 className="mt-1 font-heading text-2xl font-bold text-[#E8EDE3]">{t(program.titleKey)}</h2>
              )}
              {dayLabel && (
                <p className="mt-2 text-sm text-[#C8D5B9]" data-testid="daily-plan-day">{dayLabel}</p>
              )}
              {session.localDate && (
                <p className="mt-1 text-sm text-[#A3B197]" data-testid="daily-plan-date">
                  {translate(language, "dailyPlan.localDate", { date: session.localDate })}
                </p>
              )}
              <p className="mt-1 text-sm text-[#A3B197]">
                {translate(language, "dailyPlan.totalTime", { minutes: totalMinutes })}
              </p>
              <p className="mt-3 text-sm text-[#C8D5B9]" data-testid="daily-plan-required-progress">
                {translate(language, "dailyPlan.requiredProgress", { done: doneRequired, total: required.length })}
              </p>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-[#2D3A2E]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={required.length}
                aria-valuenow={doneRequired}
                aria-label={translate(language, "dailyPlan.requiredProgress", { done: doneRequired, total: required.length })}
                data-testid="daily-plan-progress"
              >
                <div className="h-full rounded-full bg-[#8FA680]" style={{ width: `${progress}%` }} />
              </div>
            </section>

            {session.completePlan.isPending && (
              <p className="text-sm text-[#A3B197]" data-testid="daily-plan-completing">{t("dailyPlan.status.completing")}</p>
            )}
            {session.completePlan.isError && (
              <button type="button" className="inline-flex h-11 items-center justify-center rounded-xl border border-[#4D3020] px-4 text-sm text-[#D4806A]" data-testid="daily-plan-complete-retry" onClick={() => session.completePlan.mutate(plan.id)}>
                {t("dailyPlan.complete.retry")}
              </button>
            )}
            {(planCompleteOnServer || completion?.plan_completed) && (
              <div className="rounded-2xl border border-[#2D4A2E] bg-[#1E3020] p-4" data-testid="daily-plan-completed-today">
                <p className="text-sm text-[#C8D5B9]">{t("dailyPlan.status.completedToday")}</p>
                {completion?.advanced && completion.enrollment_status === "active" && program && (
                  <p className="mt-1 text-sm text-[#8FA680]" data-testid="daily-plan-advanced">
                    {translate(language, "dailyPlan.status.advanced", {
                      day: completion.current_program_day ?? (plan.program_day ?? 0) + 1,
                      total: program.durationDays,
                    })}
                  </p>
                )}
                {(completion?.enrollment_status === "completed" ||
                  (program && plan.program_day === program.durationDays && planCompleteOnServer)) && (
                  <p className="mt-1 text-sm text-[#8FA680]" data-testid="daily-plan-program-complete">
                    {t("dailyPlan.status.programComplete")}
                  </p>
                )}
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-[#C8D5B9] underline-offset-4 hover:underline"
                  data-testid="daily-plan-view-progress"
                  onClick={() => setLocation("/progress")}
                >
                  {t("dailyPlan.viewProgress")}
                </button>
              </div>
            )}

            {session.activityQuery.isLoading && (
              <p className="text-sm text-[#7A8A72]" data-testid="daily-plan-activity-loading">{t("dailyPlan.loadingActivity")}</p>
            )}

            {plan.items.map((item) => {
              const activity = activityForKey(activities, item.item_key);
              const saving = savingKey === item.item_key;
              if (item.item_key === "mood_checkin") {
                return (
                  <MoodCheckInItem
                    key={item.item_key}
                    item={item}
                    activity={activity}
                    saving={saving}
                    disabled={busy}
                    onSave={(score) => saveItem(item, { mood_score: score })}
                  />
                );
              }
              if (item.item_key === "daily_insight") {
                return (
                  <DailyInsightItem
                    key={item.item_key}
                    item={item}
                    completed={Boolean(activity)}
                    saving={saving}
                    disabled={busy}
                    onOpen={() => setLessonOpen(true)}
                    onMarkRead={() => saveItem(item, {})}
                    reason={insightReasonText}
                  />
                );
              }
              if (item.item_key === "program_practice") {
                return (
                  <PracticeItem
                    key={item.item_key}
                    item={item}
                    completed={Boolean(activity)}
                    saving={saving}
                    disabled={busy}
                    onOpen={openPractice}
                    onComplete={() => saveItem(item, { duration_minutes: item.planned_minutes })}
                  />
                );
              }
              return (
                <ReflectionItem
                  key={item.item_key}
                  item={item}
                  activity={activity}
                  saving={saving}
                  disabled={busy}
                  onSave={(text) => saveItem(item, { reflection_text: text })}
                />
              );
            })}
          </>
        )}
      </main>

      {lessonOpen && insight && (
        <LessonReader
          lesson={insight}
          onClose={() => setLessonOpen(false)}
          markReadLabel={plan && session.completedKeys.has("daily_insight") ? t("dailyPlan.item.completed") : t("dailyPlan.item.markRead")}
          markReadDone={session.completedKeys.has("daily_insight")}
          markReadDisabled={busy}
          onMarkRead={() => {
            const item = plan?.items.find((entry) => entry.item_key === "daily_insight");
            if (item) saveItem(item, {});
          }}
        />
      )}
      {lessonOpen && plan && !insight && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4" data-testid="daily-plan-insight-missing">
          <div className="w-full rounded-2xl bg-[#1E241E] p-5">
            <p className="text-sm text-[#A3B197]">{t("dailyPlan.insight.missing")}</p>
            <button type="button" className="mt-4 h-11 w-full rounded-xl bg-[#4A5D3E] text-sm text-[#E8EDE3]" onClick={() => {
              const item = plan.items.find((entry) => entry.item_key === "daily_insight");
              if (item) saveItem(item, {});
              setLessonOpen(false);
            }}>{t("dailyPlan.item.markRead")}</button>
            <button type="button" className="mt-2 h-11 w-full text-sm text-[#A3B197]" onClick={() => setLessonOpen(false)}>{t("dailyPlan.back")}</button>
          </div>
        </div>
      )}
      {breathingOpen && <BreathingModal onClose={() => setBreathingOpen(false)} />}
      {movementOpen && (
        <MovementSession onClose={() => setMovementOpen(false)} onComplete={() => setMovementOpen(false)} />
      )}
      <BottomNav />
    </motion.div>
  );
}
