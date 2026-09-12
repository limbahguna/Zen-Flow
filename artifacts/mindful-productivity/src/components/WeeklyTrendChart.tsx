import type { WeeklyBar } from "@/lib/insights";
import { useLanguage } from "@/context/LanguageContext";

function weeklyBarColor(ratio: number): string {
  if (ratio >= 81) return "#8FA680";
  if (ratio >= 61) return "#6B8C5A";
  if (ratio >= 31) return "#4A5D3E";
  return "#3D3520";
}

/** Stable weekday keys (Mon=0..Sun=6) — used to build translation keys */
const WEEKDAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

interface WeeklyTrendChartProps {
  bars: WeeklyBar[];
}

export function WeeklyTrendChart({ bars }: WeeklyTrendChartProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-end justify-between gap-2 h-32" data-testid="weekly-trend-chart">
      {bars.map((bar, i) => {
        const hasData = bar.planned > 0;
        const heightPct = hasData ? Math.max(bar.ratio, 6) : 0;
        // Translate the weekday label; fall back to the original label if key missing
        const dayKey = WEEKDAY_KEYS[i] ?? bar.label;
        const displayLabel = t(`weekday.${dayKey}`);
        const tooltipText = hasData
          ? `${bar.done}/${bar.planned} (${bar.ratio}%)`
          : t("weekday.noTasks");
        return (
          <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5 h-full">
            <div className="flex-1 w-full flex items-end">
              <div className="w-full rounded-md bg-[#2D3A2E] h-full flex items-end overflow-hidden">
                <div
                  className="w-full rounded-md"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: hasData ? weeklyBarColor(bar.ratio) : "transparent",
                    transition: "height 0.5s ease-out, background-color 0.3s ease-out",
                  }}
                  title={tooltipText}
                  data-testid={`weekly-bar-${bar.label.toLowerCase()}`}
                />
              </div>
            </div>
            <span className={`text-xs ${bar.isFuture ? "text-[#2D3A2E]" : "text-[#7A8A72]"}`}>
              {displayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
