import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import type { StressDayView } from "@/hooks/useStressCheck";

const LEVEL_COLOR: Record<string, string> = {
  calm: "#8FA680",
  mild: "#C6A15B",
  elevated: "#D97706",
  high: "#D4806A",
};

const RECOMMENDATION_PATH: Record<string, string> = {
  "stress.recommend.breathing": "/focus",
  "stress.recommend.plan": "/daily-plan",
  "stress.recommend.intention": "/practice?tab=intentions",
  "stress.recommend.journal": "/practice?tab=journal",
  "stress.recommend.sleep": "/sleep",
  "stress.recommend.coach": "/coach",
};

export function StressCheckCard({
  isLoading,
  isError,
  today,
  threeDayElevated,
  onRetry,
}: {
  isLoading: boolean;
  isError: boolean;
  today: StressDayView | null;
  threeDayElevated: boolean;
  onRetry: () => void;
}) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex justify-center rounded-2xl border border-[#2D3A2E] bg-[#1E241E] py-6" data-testid="dashboard-stress-loading">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#8FA680] border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-start" role="alert" data-testid="dashboard-stress-error">
        <p className="text-sm text-[#D4806A]">{t("stress.progress.error")}</p>
        <button type="button" onClick={onRetry} className="mt-2 text-sm font-medium text-[#C8D5B9]">{t("progress.error.retry")}</button>
      </div>
    );
  }

  const empty = !today || today.score == null;
  const recommendation = today?.recommendationKeys[0];
  const path = recommendation ? RECOMMENDATION_PATH[recommendation] ?? "/progress" : "/progress";

  return (
    <section className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4 text-start" data-testid="dashboard-stress-card">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">{t("stress.card.title")}</p>
      {empty ? (
        <p className="mt-2 text-sm text-[#A3B197]" data-testid="dashboard-stress-empty">{t("stress.card.empty")}</p>
      ) : (
        <>
          <p className="mt-2 font-heading text-3xl text-[#E8EDE3] ltr-nums tabular-nums" data-testid="dashboard-stress-score" dir="ltr">
            <span style={{ color: LEVEL_COLOR[today.level] ?? "#8FA680" }}>{today.score}</span>
            <span className="ms-2 text-base text-[#A3B197]">{t(`stress.level.${today.level}`)}</span>
          </p>
          {today.confidence !== "none" && (
            <p className="mt-1 text-xs text-[#7A8A72]">{t(`stress.card.confidence.${today.confidence}`)}</p>
          )}
          {threeDayElevated && <p className="mt-2 text-sm text-[#C8D5B9]">{t("stress.elevated3")}</p>}
          {today.level === "high" && <p className="mt-2 text-sm text-[#C8D5B9]">{t("stress.high.support")}</p>}
          {recommendation && (
            <button type="button" onClick={() => setLocation(path)} className="mt-3 text-start text-sm font-medium text-[#C8D5B9]" data-testid="dashboard-stress-action">
              {t(recommendation)}
            </button>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-[#7A8A72]">{t("stress.card.disclaimer")}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setLocation("/progress")} className="inline-flex items-center gap-1 text-sm font-medium text-[#C8D5B9]" data-testid="dashboard-stress-progress">
          {t("stress.card.view")}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
        <button type="button" onClick={() => setLocation("/crisis")} className="text-sm font-medium text-[#D4806A]" data-testid="dashboard-stress-help">
          {t("stress.findHelp")}
        </button>
      </div>
    </section>
  );
}
