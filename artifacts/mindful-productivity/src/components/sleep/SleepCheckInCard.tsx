import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useSaveSleepCheckIn } from "@workspace/api-client-react";
import type { SleepSummary, SleepCheckInInputFeeling } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSleepAuthRequest } from "@/hooks/useSleepAuthRequest";

interface Props {
  summary: SleepSummary | undefined;
}

const FEELINGS: { value: SleepCheckInInputFeeling; labelKey: string }[] = [
  { value: "rested", labelKey: "sleep.checkin.feeling.rested" },
  { value: "okay", labelKey: "sleep.checkin.feeling.okay" },
  { value: "tired", labelKey: "sleep.checkin.feeling.tired" },
  { value: "restless", labelKey: "sleep.checkin.feeling.restless" },
];

export function SleepCheckInCard({ summary }: Props) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { request } = useSleepAuthRequest();
  const saveCheckIn = useSaveSleepCheckIn({ request });

  const [quality, setQuality] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [feeling, setFeeling] = useState<SleepCheckInInputFeeling>("okay");
  const [notes, setNotes] = useState("");

  const hasCheckedIn = !!summary?.todayCheckIn;

  const handleSubmit = () => {
    const sleepDate = new Date().toISOString().slice(0, 10);
    saveCheckIn.mutate(
      {
        data: {
          sleepDate,
          sleepQuality: quality,
          energyLevel: energy,
          feeling,
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(["/api/sleep"], (old: any) => {
            if (!old) return old;
            return {
              ...old,
              todayCheckIn: data,
              recentCheckIns: [data, ...(old.recentCheckIns || [])].slice(0, 7),
            };
          });
        },
      }
    );
  };

  return (
    <div
      className="rounded-2xl border p-5 overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, #11151F 0%, #0D1018 100%)",
        borderColor: "#232B3E",
      }}
      data-testid="sleep-checkin-card"
    >
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-[#212E4A] text-[#8FA6C8] flex items-center justify-center">
          <Sun className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading font-bold text-[#E8EDE3] text-lg leading-tight">
            {t("sleep.checkin.title")}
          </h2>
          <p className="text-xs text-[#7A8A9E]">{t("sleep.checkin.desc")}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {hasCheckedIn ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-center gap-3 p-4 rounded-xl bg-[#181F2E] border border-[#232B3E]"
          >
            <CheckCircle2 className="w-5 h-5 text-[#8FA6C8]" />
            <p className="text-sm text-[#C8D5B9]">{t("sleep.checkin.done")}</p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 relative z-10"
          >
            {/* Quality */}
            <div>
              <p className="text-xs font-medium text-[#7A8A9E] mb-3 uppercase tracking-wider">
                {t("sleep.checkin.quality")}
              </p>
              <div className="flex items-center justify-between gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={`q-${val}`}
                    onClick={() => setQuality(val)}
                    className="w-12 h-12 rounded-full font-medium transition-all"
                    style={{
                      background: quality === val ? "#8FA6C8" : "#181F2E",
                      color: quality === val ? "#0B0E14" : "#8FA6C8",
                      border: `1px solid ${quality === val ? "#8FA6C8" : "#232B3E"}`,
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Energy */}
            <div>
              <p className="text-xs font-medium text-[#7A8A9E] mb-3 uppercase tracking-wider">
                {t("sleep.checkin.energy")}
              </p>
              <div className="flex items-center justify-between gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={`e-${val}`}
                    onClick={() => setEnergy(val)}
                    className="w-12 h-12 rounded-full font-medium transition-all"
                    style={{
                      background: energy === val ? "#C8B9D5" : "#181F2E",
                      color: energy === val ? "#0B0E14" : "#C8B9D5",
                      border: `1px solid ${energy === val ? "#C8B9D5" : "#232B3E"}`,
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Feeling */}
            <div>
              <p className="text-xs font-medium text-[#7A8A9E] mb-3 uppercase tracking-wider">
                {t("sleep.checkin.feeling")}
              </p>
              <div className="flex flex-wrap gap-2">
                {FEELINGS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFeeling(f.value)}
                    className="px-4 py-2 rounded-xl text-sm transition-all"
                    style={{
                      background: feeling === f.value ? "#212E4A" : "#181F2E",
                      color: feeling === f.value ? "#E8EDE3" : "#7A8A9E",
                      border: `1px solid ${feeling === f.value ? "#3A4B70" : "#232B3E"}`,
                    }}
                  >
                    {t(f.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("sleep.checkin.notes")}
                rows={2}
                className="w-full p-3 rounded-xl text-sm resize-none focus:outline-none transition-colors"
                style={{
                  background: "#181F2E",
                  border: "1px solid #232B3E",
                  color: "#E8EDE3",
                }}
              />
            </div>

            {saveCheckIn.isError && (
              <p className="text-xs text-[#D4806A]">{t("sleep.checkin.error")}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={saveCheckIn.isPending}
              className="w-full py-3 rounded-xl font-medium transition-transform active:scale-[0.98]"
              style={{
                background: "#8FA6C8",
                color: "#0B0E14",
                opacity: saveCheckIn.isPending ? 0.7 : 1,
              }}
            >
              {saveCheckIn.isPending ? t("sleep.checkin.loading") : t("sleep.checkin.submit")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
