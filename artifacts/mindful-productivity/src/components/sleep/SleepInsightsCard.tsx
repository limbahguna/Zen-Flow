import { BarChart2, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { useGetSleepInsights, getGetSleepInsightsQueryKey } from "@workspace/api-client-react";
import { useSleepAuthRequest } from "@/hooks/useSleepAuthRequest";

interface Props {
  plan: string;
}

export function SleepInsightsCard({ plan }: Props) {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const isPremium = plan === "plus" || plan === "pro";
  const { request, enabled } = useSleepAuthRequest();

  const { data: insights, isLoading, isError } = useGetSleepInsights({
    request,
    query: { enabled: enabled && isPremium, queryKey: getGetSleepInsightsQueryKey() },
  });

  return (
    <div
      className="rounded-2xl border p-5 overflow-hidden"
      style={{
        background: "#0A0D14",
        borderColor: "#1C263A",
      }}
      data-testid="sleep-insights-card"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#1C263A] text-[#8FA6C8] flex items-center justify-center">
          <BarChart2 className="w-5 h-5" />
        </div>
        <h2 className="font-heading font-bold text-[#E8EDE3] text-lg leading-tight">
          {t("sleep.insights.title")}
        </h2>
      </div>

      {!isPremium ? (
        <div className="p-5 rounded-xl bg-[#121722] border border-[#232B3E] flex flex-col items-center text-center" data-testid="sleep-insights-locked">
          <div className="w-12 h-12 rounded-full bg-[#1C263A] flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-[#8FA6C8]" />
          </div>
          <p className="text-sm font-medium text-[#E8EDE3] mb-4">
            {t("sleep.insights.locked")}
          </p>
          <button
            onClick={() => setLocation("/plans")}
            type="button"
            data-testid="sleep-insights-view-plans"
            className="px-6 py-2 rounded-xl text-sm font-medium transition-transform active:scale-[0.98]"
            style={{
              background: "#8FA6C8",
              color: "#0A0D14",
            }}
          >
            {t("sleep.insights.upgrade")}
          </button>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-[#7A8A9E] text-center py-6">{t("sleep.loading")}</p>
      ) : isError || !insights ? (
        <p className="text-sm text-[#D4806A] text-center py-6">{t("sleep.error")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-[#121722] border border-[#1C263A]">
            <p className="text-xs text-[#7A8A9E] mb-1 uppercase tracking-wider">{t("sleep.insights.nights")}</p>
            <p className="font-heading font-bold text-[#E8EDE3] text-2xl">{insights.nightsTracked}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#121722] border border-[#1C263A]">
            <p className="text-xs text-[#7A8A9E] mb-1 uppercase tracking-wider">{t("sleep.insights.avgQuality")}</p>
            <p className="font-heading font-bold text-[#E8EDE3] text-2xl">{insights.averageQuality.toFixed(1)}<span className="text-sm text-[#7A8A9E]">/5</span></p>
          </div>
          <div className="p-4 rounded-xl bg-[#121722] border border-[#1C263A]">
            <p className="text-xs text-[#7A8A9E] mb-1 uppercase tracking-wider">{t("sleep.insights.avgEnergy")}</p>
            <p className="font-heading font-bold text-[#E8EDE3] text-2xl">{insights.averageEnergy.toFixed(1)}<span className="text-sm text-[#7A8A9E]">/5</span></p>
          </div>
          <div className="p-4 rounded-xl bg-[#121722] border border-[#1C263A]">
            <p className="text-xs text-[#7A8A9E] mb-1 uppercase tracking-wider">{t("sleep.insights.trend")}</p>
            <p className="font-heading font-bold text-[#C8B9D5] text-sm mt-1">
              {t(`sleep.insights.trend.${insights.trend}`)}
            </p>
          </div>
        </div>
      )}
      <div className="mt-4 rounded-xl border border-[#2D3A54] bg-[#1A1A2E] p-4" data-testid={plan === "pro" ? "sleep-pro-coming-soon" : "sleep-pro-locked"}>
        <div className="flex items-center gap-2">
          {plan !== "pro" && <Lock className="h-4 w-4 text-[#8FA6C8]" />}
          <p className="text-xs font-semibold uppercase tracking-wider text-[#8FA6C8]">{t("sleep.pro.title")}</p>
        </div>
        <p className="mt-2 text-sm text-[#E8EDE3]">
          {plan === "pro" ? t("sleep.insights.comingSoon") : t("sleep.pro.locked")}
        </p>
        {plan !== "pro" && (
          <button type="button" onClick={() => setLocation("/plans")} className="mt-3 rounded-lg border border-[#3A4B70] px-4 py-2 text-xs font-medium text-[#A6B8D4]" data-testid="sleep-pro-view-plans">
            {t("sleep.insights.upgrade")}
          </button>
        )}
      </div>
    </div>
  );
}
