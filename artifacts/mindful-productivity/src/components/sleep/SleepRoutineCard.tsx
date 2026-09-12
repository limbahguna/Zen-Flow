import { motion } from "framer-motion";
import { Moon, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { SleepSummary } from "@workspace/api-client-react";

interface Props {
  summary: SleepSummary | undefined;
  onStart: () => void;
}

export function SleepRoutineCard({ summary, onStart }: Props) {
  const { t } = useLanguage();
  const hasCompletedRoutine = !!summary?.todayRoutine;

  return (
    <div
      className="rounded-2xl border p-5 overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, #161224 0%, #0F0D16 100%)",
        borderColor: "#2B233F",
      }}
      data-testid="sleep-routine-card"
    >
      {/* Decorative moon glow */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(147,130,200,0.15) 0%, transparent 70%)",
          transform: "translate(30%, -30%)",
        }}
      />

      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-[#2B233F] text-[#C8B9D5] flex items-center justify-center">
          <Moon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading font-bold text-[#E8EDE3] text-lg leading-tight">
            {t("sleep.routine.title")}
          </h2>
          <p className="text-xs text-[#8B7C9E]">{t("sleep.routine.desc")}</p>
        </div>
      </div>

      <div className="relative z-10">
        {hasCompletedRoutine ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-[#1C1729] border border-[#2B233F]"
          >
            <CheckCircle2 className="w-5 h-5 text-[#C8B9D5]" />
            <p className="text-sm text-[#E8EDE3]">{t("sleep.routine.done")}</p>
          </motion.div>
        ) : (
          <button
            onClick={onStart}
            className="w-full py-3 rounded-xl font-medium transition-transform active:scale-[0.98]"
            style={{
              background: "#C8B9D5",
              color: "#0F0D16",
            }}
          >
            {t("sleep.routine.start")}
          </button>
        )}
      </div>
    </div>
  );
}
