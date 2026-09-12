import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { useTasks } from "@/hooks/useTasks";
import { MOODS } from "@/lib/moods";
import { createJournalEntry } from "@/lib/journal";

interface JournalEntryFormProps {
  onClose: () => void;
  onSaved: () => void;
}

interface StepDef {
  n: number;
  labelKey: string;
  key: "situation" | "trigger" | "evidenceFor" | "evidenceAgainst";
  placeholderKey: string;
}

const STEPS: StepDef[] = [
  { n: 1, labelKey: "journal.form.step1.label", key: "situation",      placeholderKey: "journal.form.step1.placeholder" },
  { n: 2, labelKey: "journal.form.step2.label", key: "trigger",        placeholderKey: "journal.form.step2.placeholder" },
  { n: 3, labelKey: "journal.form.step3.label", key: "evidenceFor",    placeholderKey: "journal.form.step3.placeholder" },
  { n: 4, labelKey: "journal.form.step4.label", key: "evidenceAgainst",placeholderKey: "journal.form.step4.placeholder" },
];

export function JournalEntryForm({ onClose, onSaved }: JournalEntryFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: tasks } = useTasks();

  const [taskId, setTaskId] = useState("");
  const [situation, setSituation] = useState("");
  const [trigger, setTrigger] = useState("");
  const [evidenceFor, setEvidenceFor] = useState("");
  const [evidenceAgainst, setEvidenceAgainst] = useState("");
  const [reframed, setReframed] = useState("");
  const [moodBefore, setMoodBefore] = useState<number | null>(null);
  const [moodAfter, setMoodAfter] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const values: Record<string, string> = { situation, trigger, evidenceFor, evidenceAgainst };
  const setters: Record<string, (v: string) => void> = {
    situation: setSituation,
    trigger: setTrigger,
    evidenceFor: setEvidenceFor,
    evidenceAgainst: setEvidenceAgainst,
  };

  const pendingTasks = (tasks ?? []).filter((t) => t.status === "pending");

  const canSave =
    situation.trim().length > 0 &&
    trigger.trim().length > 0 &&
    moodBefore != null &&
    moodAfter != null &&
    !saving;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!user || !canSave) return;
    setSaving(true);
    try {
      await createJournalEntry(user.id, {
        taskId: taskId || null,
        situation,
        triggerThought: trigger,
        evidenceFor,
        evidenceAgainst,
        reframedThought: reframed,
        moodBefore: moodBefore!,
        moodAfter: moodAfter!,
      });
      const diff = moodAfter! - moodBefore!;
      const moodInsight = diff > 0
        ? {
            title: t("journal.form.toast.improved.title"),
            description: t("journal.form.toast.improved.desc")
              .replace("{before}", String(moodBefore))
              .replace("{after}", String(moodAfter)),
          }
        : diff === 0
        ? {
            title: t("journal.form.toast.clarity.title"),
            description: t("journal.form.toast.clarity.desc"),
          }
        : {
            title: t("journal.form.toast.gentle.title"),
            description: t("journal.form.toast.gentle.desc"),
          };
      toast(moodInsight);
      onSaved();
    } catch {
      toast({ title: t("journal.form.toast.error.title"), description: t("journal.form.toast.error.desc"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={t("journal.form.ariaLabel")}
    >
      <header className="sticky top-0 bg-[#141814]/90 backdrop-blur-md border-b border-[#2D3A2E] z-10">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[#7A8A72] hover:text-[#A3B197] transition-colors"
            aria-label={t("common.back")}
            data-testid="button-journal-back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{t("common.back")}</span>
          </button>
          <h1 className="font-heading font-bold text-[#E8EDE3] ml-3">{t("journal.form.title")}</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-6 pb-28 space-y-6">
        <div>
          <label htmlFor="related-task" className="block text-sm font-medium text-[#C8D5B9] mb-2">
            {t("journal.form.relatedTask")} <span className="text-[#7A8A72] font-normal">({t("journal.form.optional")})</span>
          </label>
          <select
            id="related-task"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            data-testid="select-related-task"
            className="w-full h-11 px-3 rounded-xl border border-[#2D3A2E] bg-[#1A1E1A] text-sm text-[#C8D5B9] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#8FA680]"
          >
            <option value="">{t("journal.form.noTask")}</option>
            {pendingTasks.map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>
        </div>

        {STEPS.map((step) => (
          <div key={step.key}>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2D3A2E] text-[#8FA680] text-xs font-bold shrink-0">
                {step.n}
              </span>
              <label htmlFor={`field-${step.key}`} className="text-sm font-medium text-[#C8D5B9]">
                {t(step.labelKey)}
              </label>
            </div>
            <Textarea
              id={`field-${step.key}`}
              value={values[step.key]}
              onChange={(e) => setters[step.key](e.target.value)}
              placeholder={t(step.placeholderKey)}
              data-testid={`textarea-${step.key}`}
              className="min-h-[88px] bg-[#1A1E1A] border-[#2D3A2E] text-[#C8D5B9] placeholder:text-[#7A8A72] rounded-xl resize-none"
            />
          </div>
        ))}

        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1E3020] text-[#7AC47A] text-xs font-bold shrink-0">
              5
            </span>
            <label htmlFor="field-reframed" className="text-sm font-medium text-[#C8D5B9]">
              {t("journal.form.step5.label")}
            </label>
          </div>
          <Textarea
            id="field-reframed"
            value={reframed}
            onChange={(e) => setReframed(e.target.value)}
            placeholder={t("journal.form.step5.placeholder")}
            data-testid="textarea-reframed"
            className="min-h-[88px] bg-[#1A1E1A] text-[#C8D5B9] placeholder:text-[#7A8A72] rounded-xl resize-none border-2"
            style={{ borderColor: "#2A4030" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <MoodPicker label={t("journal.form.moodBefore")} value={moodBefore} onChange={setMoodBefore} testid="mood-before" />
          <MoodPicker label={t("journal.form.moodAfter")}  value={moodAfter}  onChange={setMoodAfter}  testid="mood-after"  />
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-[#141814]/90 backdrop-blur-md border-t border-[#2D3A2E]">
        <div className="max-w-2xl mx-auto px-5 py-4">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full h-12 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors disabled:opacity-50"
            data-testid="button-save-entry"
          >
            {saving ? t("journal.form.saving") : t("journal.form.save")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function MoodPicker({
  label,
  value,
  onChange,
  testid,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  testid: string;
}) {
  const { t } = useLanguage();

  return (
    <div>
      <p className="text-sm font-medium text-[#C8D5B9] mb-2.5">{label}</p>
      <div className="flex items-center justify-between gap-1">
        {MOODS.map((m) => {
          const Icon = m.icon;
          const active = value === m.value;
          return (
            <button
              key={m.value}
              onClick={() => onChange(m.value)}
              aria-pressed={active}
              aria-label={t(m.labelKey)}
              data-testid={`${testid}-${m.value}`}
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300 ${
                active ? "scale-110" : "opacity-40 hover:opacity-80"
              }`}
              style={active ? { backgroundColor: `${m.color}22` } : undefined}
            >
              <Icon className="w-6 h-6" style={{ color: m.color }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
