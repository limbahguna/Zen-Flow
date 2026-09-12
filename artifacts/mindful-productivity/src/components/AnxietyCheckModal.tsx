import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Wind, Ghost, Waves, Meh, Zap, Smile, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import type { TaskRow } from "@/lib/tasks";
import {
  createAnxietyCheck,
  markBreathingCompleted,
  type Feeling,
} from "@/lib/anxietyChecks";
import { BreathingExercise } from "./BreathingExercise";

interface FeelingOption {
  value: Feeling;
  labelKey: string;
  icon: LucideIcon;
  negative: boolean;
}

const FEELINGS: FeelingOption[] = [
  { value: "anxious",    labelKey: "anxiety.feeling.anxious",    icon: Wind,  negative: true  },
  { value: "afraid",     labelKey: "anxiety.feeling.afraid",     icon: Ghost, negative: true  },
  { value: "overwhelmed",labelKey: "anxiety.feeling.overwhelmed",icon: Waves, negative: true  },
  { value: "neutral",    labelKey: "anxiety.feeling.neutral",    icon: Meh,   negative: false },
  { value: "excited",    labelKey: "anxiety.feeling.excited",    icon: Zap,   negative: false },
  { value: "calm",       labelKey: "anxiety.feeling.calm",       icon: Smile, negative: false },
];

interface AnxietyCheckModalProps {
  task: TaskRow | null;
  onClose: () => void;
  onStarted: (task: TaskRow) => void;
}

export function AnxietyCheckModal({ task, onClose, onStarted }: AnxietyCheckModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<"check" | "breathing">("check");
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [saving, setSaving] = useState(false);
  const [checkId, setCheckId] = useState<string | null>(null);

  const open = task !== null;

  useEffect(() => {
    if (open) {
      setPhase("check");
      setFeeling(null);
      setIntensity(5);
      setSaving(false);
      setCheckId(null);
    }
  }, [open, task?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phase === "check") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, phase, onClose]);

  if (!open || !task) return null;

  const selected = FEELINGS.find((f) => f.value === feeling) ?? null;
  const breathingOffered = !!selected?.negative && intensity >= 5;

  async function saveCheck(completed: boolean): Promise<string | null> {
    if (!user || !task || !feeling) return null;
    setSaving(true);
    try {
      const row = await createAnxietyCheck(user.id, {
        taskId: task.id,
        feeling,
        intensity,
        breathingOffered,
        breathingCompleted: completed,
      });
      queryClient.invalidateQueries({ queryKey: ["anxiety_checks", user.id] });
      return row.id;
    } catch {
      toast({ title: t("anxiety.toast.error.title"), description: t("anxiety.toast.error.desc"), variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleStartBreathing() {
    const id = await saveCheck(false);
    if (!id) return;
    setCheckId(id);
    setPhase("breathing");
  }

  async function handleStartTask() {
    const id = await saveCheck(false);
    if (!id) return;
    onStarted(task!);
  }

  async function handleBreathingFinish(completed: boolean) {
    if (completed && checkId) {
      try {
        await markBreathingCompleted(checkId);
      } catch {
        toast({
          title: t("anxiety.toast.sessionUpdate.title"),
          description: t("anxiety.toast.sessionUpdate.desc"),
          variant: "destructive",
        });
      }
    }
    onStarted(task!);
  }

  if (phase === "breathing") {
    return <BreathingExercise onFinish={handleBreathingFinish} />;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        role="dialog"
        aria-modal="true"
        aria-label={t("anxiety.ariaLabel")}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#222822] border border-[#2D3A2E] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between p-6 pb-2">
          <div className="min-w-0 pr-3">
            <h2 className="text-xl font-heading font-bold text-[#E8EDE3]">{t("anxiety.title")}</h2>
            <p className="text-sm text-[#7A8A72] mt-1 truncate">{task.title}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-[#7A8A72] hover:text-[#A3B197] transition-colors"
            aria-label={t("common.close")}
            data-testid="button-anxiety-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-2">
          <div className="grid grid-cols-2 gap-2.5">
            {FEELINGS.map((f) => {
              const Icon = f.icon;
              const active = feeling === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFeeling(f.value)}
                  aria-pressed={active}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-300 ${
                    active
                      ? "bg-[#2D3A2E] border-[#8FA680] text-[#8FA680]"
                      : "bg-[#1E241E] border-[#2D3A2E] text-[#A3B197] hover:border-[#3D4D35]"
                  }`}
                  data-testid={`feeling-${f.value}`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">{t(f.labelKey)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#C8D5B9]">{t("anxiety.intensity")}</span>
              <span className="text-sm font-semibold text-[#8FA680] tabular-nums">{intensity}</span>
            </div>
            <Slider
              value={[intensity]}
              onValueChange={(v) => setIntensity(v[0] ?? 1)}
              min={1}
              max={10}
              step={1}
              data-testid="slider-intensity"
            />
            <div className="flex justify-between mt-2 text-xs text-[#7A8A72]">
              <span>{t("anxiety.mild")}</span>
              <span>{t("anxiety.intense")}</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {feeling && (
              <motion.div
                key={breathingOffered ? "breathing" : "go"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="mt-6"
              >
                {breathingOffered ? (
                  <>
                    <div className="rounded-xl bg-[#2D2420] border border-[#4D3020] p-4 mb-4">
                      <p className="text-sm text-[#D4A06A]">
                        {t("anxiety.breathingOffer")}
                      </p>
                    </div>
                    <button
                      onClick={handleStartBreathing}
                      disabled={saving}
                      className="w-full h-12 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors duration-300 disabled:opacity-60"
                      data-testid="button-start-breathing"
                    >
                      {t("anxiety.startBreathing")}
                    </button>
                    <button
                      onClick={handleStartTask}
                      disabled={saving}
                      className="w-full h-11 mt-2 rounded-xl text-[#7A8A72] text-sm font-medium hover:bg-[#1E241E] transition-colors duration-300 disabled:opacity-60"
                      data-testid="button-skip-ready"
                    >
                      {t("anxiety.skipReady")}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleStartTask}
                    disabled={saving}
                    className="w-full h-12 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors duration-300 disabled:opacity-60"
                    data-testid="button-lets-go"
                  >
                    {t("anxiety.letsGo")}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
