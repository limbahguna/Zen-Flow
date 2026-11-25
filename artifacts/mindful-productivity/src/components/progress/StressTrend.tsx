import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import type { StressDayView } from "@/hooks/useStressCheck";

const LEVEL_COLOR: Record<string, string> = {
  calm: "#8FA680",
  mild: "#C6A15B",
  elevated: "#D97706",
  high: "#D4806A",
};

export function StressTrend({
  days,
  isLoading,
  isError,
  onRetry,
}: {
  days: StressDayView[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { t } = useLanguage();
  const [range, setRange] = useState<7 | 30>(7);
  const visible = days.slice(-range);
  const hasScore = visible.some((day) => day.score != null);

  return (
    <section className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4 text-start" data-testid="stress-trend">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold text-[#E8EDE3]">{t("stress.progress.title")}</h2>
        <div className="flex rounded-xl border border-[#2D3A2E] p-1">
          {([7, 30] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`rounded-lg px-3 py-1 text-xs ${range === value ? "bg-[#2D3A2E] text-[#E8EDE3]" : "text-[#7A8A72]"}`}
              data-testid={`stress-range-${value}`}
              aria-pressed={range === value}
            >
              {t(value === 7 ? "stress.progress.range7" : "stress.progress.range30")}
            </button>
          ))}
        </div>
      </div>
      {isLoading && <div className="mt-4 h-24 animate-pulse rounded-xl bg-[#222822]" data-testid="stress-trend-loading" />}
      {isError && (
        <div className="mt-4" role="alert" data-testid="stress-trend-error">
          <p className="text-sm text-[#D4806A]">{t("stress.progress.error")}</p>
          <button type="button" onClick={onRetry} className="mt-2 text-sm text-[#C8D5B9]">{t("progress.error.retry")}</button>
        </div>
      )}
      {!isLoading && !isError && !hasScore && (
        <p className="mt-4 text-sm text-[#A3B197]" data-testid="stress-trend-empty">{t("stress.progress.empty")}</p>
      )}
      {!isLoading && !isError && hasScore && (
        <div className="mt-4 flex h-32 items-end gap-1" data-testid="stress-trend-chart">
          {visible.map((day) => (
            <div key={day.localDate} className="flex h-full flex-1 items-end">
              <div
                className="w-full rounded-md"
                style={{
                  height: day.score == null ? "4%" : `${Math.max(day.score, 6)}%`,
                  background: day.score == null ? "#2D3A2E" : LEVEL_COLOR[day.level] ?? "#8FA680",
                }}
                title={day.score == null ? "" : String(day.score)}
              />
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-[#7A8A72]">{t("stress.card.disclaimer")}</p>
    </section>
  );
}
