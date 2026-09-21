import { ArrowLeft, Check, Circle, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/BottomNav";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProgressReport } from "@/hooks/useProgress";
import { t as translate } from "@/lib/translations";
import { shareOrCopySummary } from "@/lib/wellness/shareProgress";
import { getProgram } from "@/lib/wellness/programCatalog";
import { shareSummaryText, weeklySummaryText } from "@/lib/wellness/weeklySummary";
import type { ConsistencyState, MoodDirection } from "@/lib/wellness/weeklyProgress";

function dayStateLabel(t: (key: string) => string, state: ConsistencyState, isToday: boolean): string {
  const status =
    state === "completed"
      ? t("progress.day.completed")
      : state === "partial"
        ? t("progress.day.partial")
        : t("progress.day.none");
  return isToday ? `${t("progress.day.today")}: ${status}` : status;
}

function moodLabel(t: (key: string) => string, direction: MoodDirection): string {
  if (direction === "higher") return t("progress.metrics.mood.higher");
  if (direction === "steady") return t("progress.metrics.mood.steady");
  if (direction === "lower") return t("progress.metrics.mood.lower");
  return t("progress.metrics.mood.none");
}

export default function ProgressPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const progress = useProgressReport();
  const report = progress.report;
  const program = report?.programSlug ? getProgram(report.programSlug) : null;

  async function onShare() {
    if (!report) return;
    const text = shareSummaryText(language, report);
    try {
      const result = await shareOrCopySummary(t("progress.share.title"), text);
      toast({
        title: result === "shared" ? t("progress.share.shared") : t("progress.share.copied"),
      });
    } catch {
      toast({ title: t("progress.share.error"), variant: "destructive" });
    }
  }

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
            data-testid="progress-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("progress.title")}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-8">
        {!user && (
          <div
            className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center text-sm text-[#D4806A]"
            role="alert"
            data-testid="progress-auth-error"
          >
            {t("progress.error.auth")}
          </div>
        )}

        {user && progress.prefsQuery.isSuccess && !progress.prefsQuery.data && (
          <section className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5 text-center" data-testid="progress-missing-prefs">
            <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("progress.prefs.title")}</h2>
            <p className="mt-2 text-sm text-[#A3B197]">{t("progress.prefs.body")}</p>
            <button
              type="button"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#4A5D3E] px-4 text-sm text-[#E8EDE3]"
              onClick={() => setLocation("/programs")}
            >
              {t("dailyPlan.prefs.cta")}
            </button>
          </section>
        )}

        {user && progress.isLoading && !report && (
          <div className="flex justify-center py-10" data-testid="progress-loading">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8FA680] border-t-transparent" />
            <span className="sr-only">{t("progress.loading")}</span>
          </div>
        )}

        {user && progress.isError && (
          <div className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center" role="alert" data-testid="progress-error">
            <p className="text-sm text-[#D4806A]">{t("progress.error.network")}</p>
            <button type="button" className="mt-2 text-sm text-[#C8D5B9]" onClick={progress.retry} data-testid="progress-retry">
              {t("progress.error.retry")}
            </button>
          </div>
        )}

        {user && report && !progress.enrollment && (
          <section className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5 text-center" data-testid="progress-empty-enrollment">
            <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("progress.empty.enrollment.title")}</h2>
            <p className="mt-2 text-sm text-[#A3B197]">{t("progress.empty.enrollment.body")}</p>
            <a
              href="/programs"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#4A5D3E] px-4 text-sm text-[#E8EDE3]"
              data-testid="progress-programs-cta"
              onClick={(event) => {
                event.preventDefault();
                setLocation("/programs");
              }}
            >
              {t("progress.programsCta")}
            </a>
          </section>
        )}

        {report && (
          <>
            <section className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5" data-testid="progress-header">
              {program && (
                <>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("programs.active.eyebrow")}</p>
                  <h2 className="mt-1 font-heading text-2xl font-bold text-[#E8EDE3]">{t(program.titleKey)}</h2>
                  {report.programDay != null && report.programDuration != null && (
                    <p className="mt-2 text-sm text-[#C8D5B9]" data-testid="progress-day">
                      {translate(language, "programs.active.dayOf", {
                        day: report.programDay,
                        total: report.programDuration,
                      })}
                    </p>
                  )}
                  {report.programPercent != null && (
                    <>
                      <p className="mt-1 text-sm text-[#A3B197]" data-testid="progress-percent">
                        {translate(language, "progress.percent", { percent: report.programPercent })}
                      </p>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-[#2D3A2E]"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={report.programPercent}
                        aria-label={translate(language, "progress.percent", { percent: report.programPercent })}
                        data-testid="progress-program-bar"
                      >
                        <div className="h-full rounded-full bg-[#8FA680]" style={{ width: `${report.programPercent}%` }} />
                      </div>
                    </>
                  )}
                  {report.programCompleted && (
                    <p className="mt-3 text-sm text-[#8FA680]" data-testid="progress-program-complete">
                      {t("progress.program.complete")}
                    </p>
                  )}
                </>
              )}
              <p className="mt-3 text-sm text-[#A3B197]" data-testid="progress-range">
                {translate(language, "progress.range", { start: report.start, end: report.end })}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#4A5D3E] px-4 text-sm text-[#E8EDE3]"
                  data-testid="progress-today-plan"
                  onClick={() => setLocation("/daily-plan")}
                >
                  {t("progress.todayPlan")}
                </button>
                {(typeof navigator !== "undefined" && (typeof navigator.share === "function" || Boolean(navigator.clipboard))) && (
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-[#3D4D35] px-4 text-sm text-[#C8D5B9]"
                    data-testid="progress-share"
                    onClick={() => void onShare()}
                  >
                    {t("progress.share")}
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5" data-testid="progress-consistency">
              <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("progress.consistency.title")}</h2>
              <ol className="mt-4 flex justify-between gap-1">
                {report.days.map((day) => (
                  <li key={day.localDate} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3D4D35] bg-[#222822] text-[#8FA680]"
                      aria-label={`${day.localDate}: ${dayStateLabel(t, day.state, day.isToday)}`}
                      data-testid={`progress-day-${day.localDate}`}
                      data-state={day.state}
                    >
                      {day.state === "completed" ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : day.state === "partial" ? (
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Circle className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="text-[10px] text-[#7A8A72]">{day.localDate.slice(8)}</span>
                    {day.isToday && (
                      <span className="text-[10px] text-[#8FA680]">{t("progress.day.today")}</span>
                    )}
                  </li>
                ))}
              </ol>
            </section>

            {report.plansCreated === 0 ? (
              <section className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5 text-center" data-testid="progress-empty-plans">
                <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("progress.empty.plans.title")}</h2>
                <p className="mt-2 text-sm text-[#A3B197]">{t("progress.empty.plans.body")}</p>
              </section>
            ) : (
              <section className="grid gap-3" data-testid="progress-metrics">
                <article className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("progress.metrics.plans")}</h3>
                  <p className="mt-2 text-sm text-[#E8EDE3]" data-testid="progress-plan-rate">
                    {translate(language, "progress.metrics.plansRate", {
                      completed: report.plansCompleted,
                      created: report.plansCreated,
                    })}
                  </p>
                </article>
                <article className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("progress.metrics.required")}</h3>
                  <p className="mt-2 text-sm text-[#E8EDE3]" data-testid="progress-required-rate">
                    {report.requiredRate == null
                      ? t("progress.empty.metrics")
                      : translate(language, "progress.metrics.requiredRate", {
                          completed: report.requiredCompleted,
                          total: report.requiredTotal,
                        })}
                  </p>
                </article>
                <article className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("progress.metrics.practice")}</h3>
                  <p className="mt-2 text-sm text-[#E8EDE3]" data-testid="progress-practice-count">
                    {translate(language, "progress.metrics.practiceCount", { count: report.practiceCount })}
                  </p>
                  <p className="mt-1 text-sm text-[#A3B197]" data-testid="progress-practice-minutes">
                    {report.practiceMinutes == null
                      ? t("progress.metrics.practiceNoMinutes")
                      : translate(language, "progress.metrics.practiceMinutes", { minutes: report.practiceMinutes })}
                  </p>
                </article>
                <article className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("progress.metrics.insight")}</h3>
                  <p className="mt-2 text-sm text-[#E8EDE3]" data-testid="progress-insight-count">
                    {translate(language, "progress.metrics.insightCount", { count: report.insightReadCount })}
                  </p>
                </article>
                <article className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("progress.metrics.mood")}</h3>
                  <p className="mt-2 text-sm text-[#E8EDE3]" data-testid="progress-mood-count">
                    {translate(language, "progress.metrics.moodCount", { count: report.moodCount })}
                  </p>
                  {report.moodAverage != null && (
                    <p className="mt-1 text-sm text-[#A3B197]" data-testid="progress-mood-average">
                      {translate(language, "progress.metrics.moodAverage", { average: report.moodAverage })}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-[#A3B197]" data-testid="progress-mood-direction">
                    {moodLabel(t, report.moodDirection)}
                  </p>
                </article>
                <article className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("progress.metrics.reflection")}</h3>
                  <p className="mt-2 text-sm text-[#E8EDE3]" data-testid="progress-reflection-count">
                    {translate(language, "progress.metrics.reflectionCount", { count: report.reflectionCount })}
                  </p>
                </article>
                <article className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4">
                  <h3 className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("progress.streak.label")}</h3>
                  <p className="mt-2 text-sm text-[#E8EDE3]" data-testid="progress-streak">
                    {translate(language, "progress.streak.days", { count: report.streak })}
                  </p>
                </article>
              </section>
            )}

            <section className="rounded-2xl border border-[#3D4D35] bg-[#222822] p-5" data-testid="progress-summary">
              <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("progress.summary.title")}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#C8D5B9]" data-testid="progress-summary-text">
                {weeklySummaryText(language, report)}
              </p>
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </motion.div>
  );
}
