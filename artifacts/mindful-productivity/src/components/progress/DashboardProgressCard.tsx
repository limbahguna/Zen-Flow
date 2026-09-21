import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { t as translate } from "@/lib/translations";
import { useProgressReport } from "@/hooks/useProgress";
import { getProgram } from "@/lib/wellness/programCatalog";

export function DashboardProgressCard() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { report, isLoading, isError, retry, enrollment } = useProgressReport();
  const program = report?.programSlug ? getProgram(report.programSlug) : null;

  if (isLoading) {
    return (
      <div
        className="flex justify-center rounded-2xl border border-[#2D3A2E] bg-[#222822] py-6"
        data-testid="dashboard-progress-loading"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#8FA680] border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center"
        role="alert"
        data-testid="dashboard-progress-error"
      >
        <p className="text-sm text-[#D4806A]">{t("progress.error.network")}</p>
        <button type="button" onClick={retry} className="mt-2 text-sm font-medium text-[#C8D5B9]">
          {t("progress.error.retry")}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLocation("/progress")}
      className="w-full rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4 text-left"
      aria-label={t("progress.card.view")}
      data-testid="dashboard-progress-card"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("progress.card.title")}</p>
          {enrollment && program && report?.programDay != null && report.programDuration != null && (
            <p className="mt-1 text-sm text-[#E8EDE3]" data-testid="dashboard-progress-day">
              {translate(language, "programs.active.dayOf", {
                day: report.programDay,
                total: report.programDuration,
              })}
            </p>
          )}
          {report && (
            <>
              <p className="mt-1 text-sm text-[#A3B197]" data-testid="dashboard-progress-week">
                {translate(language, "progress.card.completedCount", { count: report.plansCompleted })}
              </p>
              <p className="mt-1 text-sm text-[#A3B197]" data-testid="dashboard-progress-streak">
                {t("progress.streak.label")}: {translate(language, "progress.streak.days", { count: report.streak })}
              </p>
            </>
          )}
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#C8D5B9]">
            {t("progress.card.view")}
            <ChevronRight className="h-4 w-4" />
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#7A8A72]" />
      </div>
    </button>
  );
}
