import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Trophy, Mountain, Map, Check, ArrowLeft, ArrowRight, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { createWoopTask } from "@/lib/tasks";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { trackEvent } from "@/lib/analytics";

const MIN_LEN = 10;
const DRAFT_KEY = "woop-draft";

type FieldKey = "wish" | "outcome" | "obstacle" | "plan";

interface WoopForm {
  wish: string;
  outcome: string;
  obstacle: string;
  plan: string;
}

const EMPTY: WoopForm = { wish: "", outcome: "", obstacle: "", plan: "" };

interface StepDef {
  key: FieldKey;
  icon: typeof Sparkles;
  headerKey: string;
  subtitleKey: string;
  placeholderKey: string;
  iconColor: string;
  iconBg: string;
}

const STEPS: StepDef[] = [
  {
    key: "wish",
    icon: Sparkles,
    headerKey: "woop.wish.header",
    subtitleKey: "woop.wish.subtitle",
    placeholderKey: "woop.wish.placeholder",
    iconColor: "#8FA680",
    iconBg: "#2D3A2E",
  },
  {
    key: "outcome",
    icon: Trophy,
    headerKey: "woop.outcome.header",
    subtitleKey: "woop.outcome.subtitle",
    placeholderKey: "woop.outcome.placeholder",
    iconColor: "#7AC47A",
    iconBg: "#1E3020",
  },
  {
    key: "obstacle",
    icon: Mountain,
    headerKey: "woop.obstacle.header",
    subtitleKey: "woop.obstacle.subtitle",
    placeholderKey: "woop.obstacle.placeholder",
    iconColor: "#D4806A",
    iconBg: "#2D2420",
  },
  {
    key: "plan",
    icon: Map,
    headerKey: "woop.plan.header",
    subtitleKey: "woop.plan.subtitle",
    placeholderKey: "woop.plan.placeholder",
    iconColor: "#D4B96A",
    iconBg: "#3D3520",
  },
];

function loadDraft(): WoopForm {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

interface WoopWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function WoopWizard({ open, onClose, onCreated }: WoopWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const { register, watch, reset, getValues } = useForm<WoopForm>({
    defaultValues: loadDraft(),
  });

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const persistPausedRef = useRef(false);

  useEffect(() => {
    const sub = watch((values) => {
      if (persistPausedRef.current) return;
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(values)); } catch { /* best-effort */ }
    });
    return () => sub.unsubscribe();
  }, [watch]);

  useEffect(() => {
    if (open) {
      persistPausedRef.current = false;
      setStep(0);
      setDirection(1);
      setSuccess(false);
      setSaving(false);
      reset(loadDraft());
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const currentValue = watch(current.key) ?? "";
  const obstacleValue = watch("obstacle") ?? "";
  const canProceed = currentValue.trim().length >= MIN_LEN;

  const next = () => {
    if (!canProceed) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleCreate = async () => {
    if (!user || !canProceed) return;
    setSaving(true);
    try {
      const v = getValues();
      await createWoopTask(user.id, { wish: v.wish, outcome: v.outcome, obstacle: v.obstacle, plan: v.plan });
      persistPausedRef.current = true;
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* best-effort */ }
      reset(EMPTY);
      setSuccess(true);
      trackEvent("task_created", { workflow: "woop" });
      toast({ title: t("woop.toast.created.title"), description: t("woop.toast.created.desc") });
      setTimeout(() => { onCreated(); }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("woop.toast.error.desc");
      toast({ title: t("woop.toast.error.title"), description: message, variant: "destructive" });
      setSaving(false);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -50 : 50, opacity: 0 }),
  };

  const Icon = current.icon;
  const obstacleText = obstacleValue.trim() || t("woop.plan.obstacleDefault");
  const planHeader = t("woop.plan.ifThen").replace("{obstacle}", obstacleText);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("woop.ariaLabel")}
            className="w-full max-w-md bg-[#222822] border border-[#2D3A2E] rounded-2xl overflow-hidden"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              <div className="p-8 flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="w-20 h-20 rounded-full bg-[#1E3020] flex items-center justify-center mb-6"
                >
                  <Check className="w-10 h-10 text-[#7AC47A] stroke-[3]" />
                </motion.div>
                <h2 className="text-2xl font-heading font-bold text-[#E8EDE3] mb-2">
                  {t("woop.success.title")}
                </h2>
                <p className="text-[#A3B197]">
                  {t("woop.success.body")}
                </p>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium text-[#7A8A72]">
                    {t("woop.stepOf").replace("{step}", String(step + 1)).replace("{total}", String(STEPS.length))}
                  </span>
                  <button
                    onClick={onClose}
                    className="p-1.5 -mr-1.5 text-[#7A8A72] hover:text-[#A3B197] rounded-lg hover:bg-[#1E241E] transition-colors"
                    data-testid="button-cancel-woop"
                    aria-label={t("common.close")}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="h-1.5 w-full rounded-full bg-[#2D3A2E] overflow-hidden mb-6">
                  <motion.div
                    className="h-full rounded-full bg-[#8FA680]"
                    initial={false}
                    animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>

                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={current.key}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                      style={{ backgroundColor: current.iconBg }}
                    >
                      <Icon className="w-7 h-7" style={{ color: current.iconColor }} />
                    </div>

                    <h2 className="text-2xl font-heading font-bold text-[#E8EDE3] leading-snug">
                      {current.key === "plan" ? planHeader : t(current.headerKey)}
                    </h2>
                    <p className="text-[#A3B197] mt-1.5 mb-5">{t(current.subtitleKey)}</p>

                    {STEPS.map((s) => (
                      <Textarea
                        key={s.key}
                        {...register(s.key)}
                        placeholder={t(s.placeholderKey)}
                        className={`rounded-xl min-h-[120px] resize-none text-sm bg-[#1A1E1A] border-[#2D3A2E] text-[#C8D5B9] placeholder:text-[#7A8A72] ${
                          s.key === current.key ? "" : "hidden"
                        }`}
                        autoFocus={s.key === current.key}
                        data-testid={`input-woop-${s.key}`}
                      />
                    ))}

                    <div className="mt-2 text-right">
                      <span className={`text-xs ${canProceed ? "text-[#7AC47A]" : "text-[#7A8A72]"}`}>
                        {currentValue.trim().length}/{MIN_LEN} {t("woop.characters")}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="flex items-center gap-3 mt-6">
                  {step > 0 && (
                    <button
                      onClick={back}
                      className="flex-1 h-11 rounded-xl border border-[#2D3A2E] text-[#A3B197] text-sm font-medium flex items-center justify-center gap-1 hover:bg-[#1E241E] transition-colors"
                      data-testid="button-woop-back"
                    >
                      <ArrowLeft className="w-4 h-4" /> {t("woop.back")}
                    </button>
                  )}
                  {isLast ? (
                    <button
                      onClick={handleCreate}
                      disabled={!canProceed || saving}
                      className="flex-[1.4] h-12 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors disabled:opacity-50"
                      data-testid="button-woop-create"
                    >
                      {saving ? t("woop.creating") : t("woop.setIntention")}
                    </button>
                  ) : (
                    <button
                      onClick={next}
                      disabled={!canProceed}
                      className="flex-1 h-11 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium flex items-center justify-center gap-1 hover:bg-[#6B8C5A] transition-colors disabled:opacity-50"
                      data-testid="button-woop-next"
                    >
                      {t("woop.next")} <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
