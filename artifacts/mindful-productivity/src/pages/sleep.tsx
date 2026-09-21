import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { getGetSleepSummaryQueryKey, useGetSleepSummary } from "@workspace/api-client-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/context/LanguageContext";
import { useSleepAuthRequest } from "@/hooks/useSleepAuthRequest";

import { SleepCheckInCard } from "@/components/sleep/SleepCheckInCard";
import { SleepRoutineCard } from "@/components/sleep/SleepRoutineCard";
import { SleepJournalCard } from "@/components/sleep/SleepJournalCard";
import { SleepInsightsCard } from "@/components/sleep/SleepInsightsCard";
import { SleepRoutineFlow } from "@/components/sleep/SleepRoutineFlow";

export default function SleepPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { data: sub } = useSubscription();
  const plan = sub?.activePlan || "free";
  const { request, enabled } = useSleepAuthRequest();

  const { data: summary, isLoading, isError, refetch } = useGetSleepSummary({
    request,
    query: { enabled, queryKey: getGetSleepSummaryQueryKey(), retry: false },
  });

  const [routineOpen, setRoutineOpen] = useState(false);

  return (
    <motion.div
      className="min-h-screen bg-[#070A10] pb-24 text-[#E8EDE3]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      data-testid="sleep-hub-page"
    >
      <header className="sticky top-0 z-10 bg-[#070A10]/90 backdrop-blur-md border-b border-[#1C263A]">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={() => {
              const fromDailyPlan = new URLSearchParams(window.location.search).get("from") === "daily-plan";
              setLocation(fromDailyPlan ? "/daily-plan" : "/dashboard");
            }}
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#8FA6C8] hover:bg-[#121722] transition-colors"
            aria-label={t("sleep.backToDashboard")}
            data-testid="sleep-back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="font-heading font-bold text-lg">{t("sleep.hub.title")}</h1>
            <p className="text-xs text-[#7A8A9E]">{t("sleep.hub.subtitle")}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {isLoading ? (
          <div className="py-20 text-center" data-testid="sleep-loading">
            <p className="text-[#7A8A9E]">{t("sleep.loading")}</p>
          </div>
        ) : isError ? (
          <div className="py-20 text-center" data-testid="sleep-error">
            <p className="text-[#D4806A] mb-4">{t("sleep.error")}</p>
            <button
              onClick={() => refetch()}
              className="px-6 py-2 rounded-xl bg-[#1C263A] text-[#8FA6C8] text-sm font-medium"
              data-testid="sleep-retry"
            >
              {t("sleep.retry")}
            </button>
          </div>
        ) : (
          <>
            <SleepCheckInCard summary={summary} />
            <SleepRoutineCard summary={summary} onStart={() => setRoutineOpen(true)} />
            <SleepJournalCard summary={summary} />
            <SleepInsightsCard plan={plan} />
          </>
        )}
      </main>

      <AnimatePresence>
        {routineOpen && (
          <SleepRoutineFlow onClose={() => {
            setRoutineOpen(false);
            refetch(); // Refresh summary to show routine as completed
          }} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
