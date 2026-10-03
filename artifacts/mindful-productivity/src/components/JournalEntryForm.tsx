import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { useTasks } from "@/hooks/useTasks";
import { MOODS } from "@/lib/moods";
import { createJournalEntry, updateJournalEntry, type JournalEntryRow } from "@/lib/journal";
import {
  clearJournalDraft,
  loadJournalDraft,
  saveJournalDraft,
  type JournalDraft,
} from "@/lib/journalDraft";

interface JournalEntryFormProps {
  onClose: () => void;
  onSaved: (entry?: JournalEntryRow) => void;
  /** When present the form edits this entry in place instead of creating one. */
  entry?: JournalEntryRow | null;
}

/** The saved row as form values, used to prefill an edit and to revert one. */
function draftFromEntry(entry: JournalEntryRow): JournalDraft {
  return {
    taskId: entry.task_id ?? "",
    situation: entry.situation ?? "",
    trigger: entry.trigger_thought ?? "",
    evidenceFor: entry.evidence_for ?? "",
    evidenceAgainst: entry.evidence_against ?? "",
    reframed: entry.reframed_thought ?? "",
    moodBefore: entry.mood_before,
    moodAfter: entry.mood_after,
  };
}

type FieldKey = "situation" | "trigger" | "evidenceFor" | "evidenceAgainst" | "reframed";

interface StepDef {
  n: number;
  labelKey: string;
  key: FieldKey;
  placeholderKey: string;
  required: boolean;
}

const STEPS: StepDef[] = [
  { n: 1, labelKey: "journal.form.step1.label", key: "situation",       placeholderKey: "journal.form.step1.placeholder", required: true  },
  { n: 2, labelKey: "journal.form.step2.label", key: "trigger",         placeholderKey: "journal.form.step2.placeholder", required: true  },
  { n: 3, labelKey: "journal.form.step3.label", key: "evidenceFor",     placeholderKey: "journal.form.step3.placeholder", required: false },
  { n: 4, labelKey: "journal.form.step4.label", key: "evidenceAgainst", placeholderKey: "journal.form.step4.placeholder", required: false },
  { n: 5, labelKey: "journal.form.step5.label", key: "reframed",        placeholderKey: "journal.form.step5.placeholder", required: false },
];

interface SavedSummary {
  answered: number;
  moodBefore: number;
  moodAfter: number;
  /** The row returned by the server, so the caller can refresh its view. */
  row: JournalEntryRow;
}

/**
 * Journal mood runs 2 (Awful) → 10 (Great), so a higher score is a better mood
 * and `after - before > 0` is the only case that may be called an improvement.
 * See MOODS in lib/moods.ts and the shared `after - before` maths in
 * journal.tsx, dashboard.tsx and weeklyReport.ts.
 */
function moodMessageKey(before: number, after: number): string {
  if (after > before) return "journal.form.done.mood.improved";
  if (after === before) return "journal.form.done.mood.same";
  return "journal.form.done.mood.lower";
}

export function JournalEntryForm({ onClose, onSaved, entry = null }: JournalEntryFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: tasks } = useTasks();

  const isEditing = entry != null;
  const savedValues = entry ? draftFromEntry(entry) : null;
  const savedJson = savedValues ? JSON.stringify(savedValues) : null;

  // An unfinished draft wins over the saved row so in-progress edits survive
  // closing the form; with no draft an edit opens on exactly what was saved.
  const [restoredDraft] = useState<JournalDraft | null>(() =>
    loadJournalDraft(user?.id, entry?.id),
  );
  const initial = restoredDraft ?? savedValues;

  const [taskId, setTaskId] = useState(initial?.taskId ?? "");
  const [situation, setSituation] = useState(initial?.situation ?? "");
  const [trigger, setTrigger] = useState(initial?.trigger ?? "");
  const [evidenceFor, setEvidenceFor] = useState(initial?.evidenceFor ?? "");
  const [evidenceAgainst, setEvidenceAgainst] = useState(initial?.evidenceAgainst ?? "");
  const [reframed, setReframed] = useState(initial?.reframed ?? "");
  const [moodBefore, setMoodBefore] = useState<number | null>(initial?.moodBefore ?? null);
  const [moodAfter, setMoodAfter] = useState<number | null>(initial?.moodAfter ?? null);
  const [saving, setSaving] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [draftNoticeOpen, setDraftNoticeOpen] = useState(restoredDraft != null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [saved, setSaved] = useState<SavedSummary | null>(null);

  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLTextAreaElement | null>>>({});

  const values: Record<FieldKey, string> = { situation, trigger, evidenceFor, evidenceAgainst, reframed };
  const setters: Record<FieldKey, (v: string) => void> = {
    situation: setSituation,
    trigger: setTrigger,
    evidenceFor: setEvidenceFor,
    evidenceAgainst: setEvidenceAgainst,
    reframed: setReframed,
  };

  const pendingTasks = (tasks ?? []).filter((task) => task.status === "pending");

  const answeredCount = STEPS.filter((step) => values[step.key].trim().length > 0).length;
  const currentStep = Math.min(answeredCount + 1, STEPS.length);

  function collectMissing(): string[] {
    const missing: string[] = [];
    for (const step of STEPS) {
      if (step.required && values[step.key].trim().length === 0) missing.push(t(step.labelKey));
    }
    if (moodBefore == null) missing.push(t("journal.form.moodBefore"));
    if (moodAfter == null) missing.push(t("journal.form.moodAfter"));
    return missing;
  }

  const isComplete = collectMissing().length === 0;

  // Persist unfinished work so closing the form never loses the writing. Edit
  // drafts live under their own entry-scoped key, and only exist while the form
  // differs from what is stored — matching the saved row means nothing is
  // pending, so the draft is dropped rather than rewritten.
  useEffect(() => {
    if (saved) return;
    const current = {
      taskId, situation, trigger, evidenceFor, evidenceAgainst, reframed, moodBefore, moodAfter,
    };
    if (savedJson && JSON.stringify(current) === savedJson) {
      clearJournalDraft(user?.id, entry?.id);
      return;
    }
    saveJournalDraft(user?.id, current, entry?.id);
  }, [user?.id, entry?.id, savedJson, taskId, situation, trigger, evidenceFor, evidenceAgainst, reframed, moodBefore, moodAfter, saved]);

  // Clear the validation banner as soon as the user completes what was missing.
  useEffect(() => {
    if (missingFields.length > 0 && isComplete) setMissingFields([]);
  }, [missingFields.length, isComplete]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (saved) onSaved();
      else onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onSaved, saved]);

  /**
   * Throws away unsaved work. For a new entry that means an empty form; for an
   * edit it restores exactly what is stored, never a blank entry.
   */
  function discardDraft() {
    const reset = savedValues;
    setTaskId(reset?.taskId ?? "");
    setSituation(reset?.situation ?? "");
    setTrigger(reset?.trigger ?? "");
    setEvidenceFor(reset?.evidenceFor ?? "");
    setEvidenceAgainst(reset?.evidenceAgainst ?? "");
    setReframed(reset?.reframed ?? "");
    setMoodBefore(reset?.moodBefore ?? null);
    setMoodAfter(reset?.moodAfter ?? null);
    setMissingFields([]);
    setConfirmingDiscard(false);
    setDraftNoticeOpen(false);
    clearJournalDraft(user?.id, entry?.id);
  }

  function focusFirstIncomplete() {
    const step = STEPS.find((s) => s.required && values[s.key].trim().length === 0);
    const element = step
      ? fieldRefs.current[step.key]
      : document.getElementById(moodBefore == null ? "mood-before-group" : "mood-after-group");
    if (!element) return;
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "center" });
    }
    if (element instanceof HTMLTextAreaElement) element.focus();
  }

  async function handleSave() {
    if (!user || saving) return;

    const missing = collectMissing();
    if (missing.length > 0) {
      setMissingFields(missing);
      focusFirstIncomplete();
      return;
    }

    setMissingFields([]);
    setSaving(true);
    try {
      const input = {
        taskId: taskId || null,
        situation,
        triggerThought: trigger,
        evidenceFor,
        evidenceAgainst,
        reframedThought: reframed,
        moodBefore: moodBefore!,
        moodAfter: moodAfter!,
      };

      // Editing updates the existing row in place, so the id and created_at
      // stay as they were and no duplicate entry is written.
      const row = entry
        ? await updateJournalEntry(entry.id, input)
        : await createJournalEntry(user.id, input);

      clearJournalDraft(user.id, entry?.id);
      setSaved({
        answered: answeredCount,
        moodBefore: moodBefore!,
        moodAfter: moodAfter!,
        row,
      });
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
      aria-label={t(isEditing ? "journal.form.editAriaLabel" : "journal.form.ariaLabel")}
    >
      <header className="sticky top-0 bg-[#141814]/90 backdrop-blur-md border-b border-[#2D3A2E] z-10">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center">
          <button
            onClick={saved ? () => onSaved(saved.row) : onClose}
            className="flex items-center gap-1.5 text-[#7A8A72] hover:text-[#A3B197] transition-colors"
            aria-label={t("common.back")}
            data-testid="button-journal-back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{t("common.back")}</span>
          </button>
          <h1 className="font-heading font-bold text-[#E8EDE3] ml-3" data-testid="journal-form-title">
            {t(isEditing ? "journal.form.editTitle" : "journal.form.title")}
          </h1>
        </div>
        {!saved && (
          <div className="max-w-2xl mx-auto px-4 pb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#8FA680]" data-testid="journal-progress">
                {t("journal.form.progress")
                  .replace("{current}", String(currentStep))
                  .replace("{total}", String(STEPS.length))}
              </span>
            </div>
            <div className="h-1 rounded-full bg-[#2D3A2E] overflow-hidden">
              <div
                className="h-full bg-[#6B8C5A] transition-all duration-300"
                style={{ width: `${(answeredCount / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {saved ? (
        <div className="max-w-2xl mx-auto px-5 pt-10 pb-28" data-testid="journal-saved-state">
          <div className="flex flex-col items-center text-center">
            <div className="w-[96px] h-[96px] rounded-full bg-[#1E3020] flex items-center justify-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-[#7AC47A]" />
            </div>
            <h2 className="font-heading font-bold text-xl text-[#E8EDE3]" data-testid="journal-saved-title">
              {t(isEditing ? "journal.form.done.updatedTitle" : "journal.form.done.title")}
            </h2>
            <p
              className="text-[#A3B197] mt-2 leading-relaxed max-w-sm"
              data-testid="journal-saved-mood-message"
            >
              {t(moodMessageKey(saved.moodBefore, saved.moodAfter))}
            </p>
          </div>

          <div className="mt-7 rounded-2xl border border-[#2D3A2E] bg-[#222822] p-5 space-y-2">
            <p className="text-sm text-[#C8D5B9]" data-testid="journal-saved-answered">
              📝 {saved.answered === STEPS.length
                ? t("journal.form.done.answered.all").replace("{total}", String(STEPS.length))
                : t("journal.form.done.answered.partial")
                    .replace("{answered}", String(saved.answered))
                    .replace("{total}", String(STEPS.length))
                    .replace("{skipped}", String(STEPS.length - saved.answered))}
            </p>
            <p className="text-sm text-[#C8D5B9]" data-testid="journal-saved-mood">
              {t("journal.form.done.mood")
                .replace("{before}", String(saved.moodBefore))
                .replace("{after}", String(saved.moodAfter))}
            </p>
          </div>

          <p className="text-sm text-[#8FA680] leading-relaxed mt-5" data-testid="journal-saved-next">
            {t("journal.form.done.next")}
          </p>

          <button
            onClick={() => onSaved(saved.row)}
            className="w-full h-12 mt-7 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors"
            data-testid="button-journal-done"
          >
            {t("journal.form.done.cta")}
          </button>
        </div>
      ) : (
        <>
          <div className="max-w-2xl mx-auto px-5 pt-6 pb-28 space-y-6">
            {draftNoticeOpen && (
              <div
                className="rounded-xl border border-[#3D4D35] bg-[#1E241E] px-4 py-3"
                data-testid="journal-draft-notice"
              >
                {confirmingDiscard ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[#E8B9A8]" data-testid="journal-draft-warning">
                      {t(isEditing ? "journal.form.draft.confirmRevert" : "journal.form.draft.confirm")}
                    </p>
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        onClick={discardDraft}
                        className="text-sm font-medium text-[#D4806A] hover:text-[#E8B9A8] transition-colors"
                        data-testid="button-confirm-discard-draft"
                      >
                        {t(isEditing ? "journal.form.draft.confirmRevertYes" : "journal.form.draft.confirmYes")}
                      </button>
                      <button
                        onClick={() => setConfirmingDiscard(false)}
                        className="text-sm font-medium text-[#8FA680] hover:text-[#C8D5B9] transition-colors"
                        data-testid="button-cancel-discard-draft"
                      >
                        {t("journal.form.draft.confirmNo")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[#A3B197]">
                      {t(isEditing ? "journal.form.draft.restoredEdit" : "journal.form.draft.restored")}
                    </p>
                    <button
                      onClick={() => setConfirmingDiscard(true)}
                      className="text-sm font-medium text-[#8FA680] hover:text-[#C8D5B9] transition-colors shrink-0"
                      data-testid="button-discard-draft"
                    >
                      {t(isEditing ? "journal.form.draft.revert" : "journal.form.draft.discard")}
                    </button>
                  </div>
                )}
              </div>
            )}

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

            {STEPS.map((step) => {
              const isFinalStep = step.n === STEPS.length;
              return (
                <div key={step.key}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                        isFinalStep ? "bg-[#1E3020] text-[#7AC47A]" : "bg-[#2D3A2E] text-[#8FA680]"
                      }`}
                    >
                      {step.n}
                    </span>
                    <label htmlFor={`field-${step.key}`} className="text-sm font-medium text-[#C8D5B9]">
                      {t(step.labelKey)}{" "}
                      <span className="text-[#7A8A72] font-normal" data-testid={`field-requirement-${step.key}`}>
                        ({t(step.required ? "journal.form.required" : "journal.form.optional")})
                      </span>
                    </label>
                  </div>
                  <Textarea
                    id={`field-${step.key}`}
                    ref={(el: HTMLTextAreaElement | null) => { fieldRefs.current[step.key] = el; }}
                    value={values[step.key]}
                    onChange={(e) => setters[step.key](e.target.value)}
                    placeholder={t(step.placeholderKey)}
                    data-testid={`textarea-${step.key}`}
                    className={
                      isFinalStep
                        ? "min-h-[88px] bg-[#1A1E1A] text-[#C8D5B9] placeholder:text-[#7A8A72] rounded-xl resize-none border-2"
                        : "min-h-[88px] bg-[#1A1E1A] border-[#2D3A2E] text-[#C8D5B9] placeholder:text-[#7A8A72] rounded-xl resize-none"
                    }
                    style={isFinalStep ? { borderColor: "#2A4030" } : undefined}
                  />
                </div>
              );
            })}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <MoodPicker label={t("journal.form.moodBefore")} value={moodBefore} onChange={setMoodBefore} testid="mood-before" required />
              <MoodPicker label={t("journal.form.moodAfter")}  value={moodAfter}  onChange={setMoodAfter}  testid="mood-after"  required />
            </div>
          </div>

          <div className="fixed bottom-0 inset-x-0 bg-[#141814]/90 backdrop-blur-md border-t border-[#2D3A2E]">
            <div className="max-w-2xl mx-auto px-5 py-4 space-y-3">
              {missingFields.length > 0 && (
                <div
                  role="alert"
                  data-testid="journal-validation-message"
                  className="rounded-xl border border-[#5A3A32] bg-[#2A1E1A] px-4 py-3"
                >
                  <p className="text-sm font-medium text-[#E8B9A8]">{t("journal.form.validation.title")}</p>
                  <p className="text-sm text-[#D4A192] mt-0.5">
                    {t("journal.form.validation.body").replace("{fields}", missingFields.join(", "))}
                  </p>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                aria-disabled={!isComplete}
                className="w-full h-12 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors disabled:opacity-50"
                data-testid="button-save-entry"
              >
                {saving
                  ? t("journal.form.saving")
                  : t(isEditing ? "journal.form.update" : "journal.form.save")}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

function MoodPicker({
  label,
  value,
  onChange,
  testid,
  required = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  testid: string;
  required?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div id={`${testid}-group`}>
      <p className="text-sm font-medium text-[#C8D5B9] mb-2.5">
        {label}{" "}
        {required && (
          <span className="text-[#7A8A72] font-normal">({t("journal.form.required")})</span>
        )}
      </p>
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
