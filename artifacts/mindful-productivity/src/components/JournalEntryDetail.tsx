import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Pencil } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTasks } from "@/hooks/useTasks";
import type { JournalEntryRow } from "@/lib/journal";
import { journalMoodMessageKey, journalReflection } from "@/lib/journalReflection";
import { openBlankIntention } from "@/lib/intentionSeed";

/** Detail view of a saved journal entry, with a way into editing it. */

interface JournalEntryDetailProps {
  entry: JournalEntryRow;
  onClose: () => void;
  onEdit: () => void;
}

const DETAIL_FIELDS: { n: number; labelKey: string; read: (e: JournalEntryRow) => string | null }[] = [
  { n: 1, labelKey: "journal.form.step1.label", read: (e) => e.situation },
  { n: 2, labelKey: "journal.form.step2.label", read: (e) => e.trigger_thought },
  { n: 3, labelKey: "journal.form.step3.label", read: (e) => e.evidence_for },
  { n: 4, labelKey: "journal.form.step4.label", read: (e) => e.evidence_against },
  { n: 5, labelKey: "journal.form.step5.label", read: (e) => e.reframed_thought },
];

function formatDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(
      lang === "ja" ? "ja-JP" : lang === "id" ? "id-ID" : "en-US",
      { month: "short", day: "numeric", year: "numeric" },
    );
  } catch {
    return "";
  }
}

export function JournalEntryDetail({ entry, onClose, onEdit }: JournalEntryDetailProps) {
  const { language, t } = useLanguage();
  const { data: tasks } = useTasks();

  const relatedTask = entry.task_id
    ? (tasks ?? []).find((task) => task.id === entry.task_id)
    : undefined;
  const reflection = journalReflection(entry);
  const moodMessageKey = journalMoodMessageKey(reflection.direction);
  const changeKey =
    reflection.direction === "up"
      ? "journal.detail.summary.changeUp"
      : reflection.direction === "down"
        ? "journal.detail.summary.changeDown"
        : reflection.direction === "same"
          ? "journal.detail.summary.changeSame"
          : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={t("journal.detail.ariaLabel")}
      data-testid="journal-detail"
    >
      <header className="sticky top-0 bg-[#141814]/90 backdrop-blur-md border-b border-[#2D3A2E] z-10">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[#7A8A72] hover:text-[#A3B197] transition-colors"
            aria-label={t("journal.detail.close")}
            data-testid="button-detail-close"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{t("journal.detail.close")}</span>
          </button>
          <h1 className="font-heading font-bold text-[#E8EDE3] ml-3">{t("journal.detail.title")}</h1>
          <button
            onClick={onEdit}
            className="ml-auto flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#2D3A2E] text-[#C8D5B9] text-sm font-medium hover:bg-[#3D4D35] transition-colors"
            data-testid="button-edit-entry"
          >
            <Pencil className="w-4 h-4" />
            {t("journal.detail.edit")}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-6 pb-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#7A8A72]">{formatDate(entry.created_at, language)}</span>
          {entry.mood_before != null && entry.mood_after != null && (
            <span className="text-sm text-[#C8D5B9]" data-testid="journal-detail-mood">
              {t("journal.card.mood")} {entry.mood_before} → {entry.mood_after}
            </span>
          )}
        </div>

        {relatedTask && (
          <div className="rounded-xl border border-[#2D3A2E] bg-[#1E241E] px-4 py-3">
            <p className="text-xs text-[#7A8A72] mb-1">{t("journal.detail.relatedTask")}</p>
            <p className="text-sm text-[#C8D5B9]">{relatedTask.title}</p>
          </div>
        )}

        {DETAIL_FIELDS.map((field) => {
          const answer = (field.read(entry) ?? "").trim();
          return (
            <div key={field.n}>
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                    field.n === DETAIL_FIELDS.length
                      ? "bg-[#1E3020] text-[#7AC47A]"
                      : "bg-[#2D3A2E] text-[#8FA680]"
                  }`}
                >
                  {field.n}
                </span>
                <p className="text-sm font-medium text-[#C8D5B9]">{t(field.labelKey)}</p>
              </div>
              <p
                className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  answer ? "text-[#C8D5B9]" : "text-[#7A8A72] italic"
                }`}
                data-testid={`journal-detail-field-${field.n}`}
              >
                {answer || t("journal.detail.unanswered")}
              </p>
            </div>
          );
        })}

        <section
          className="rounded-2xl border border-[#3D4D35] bg-[#1E241E] p-5 space-y-3"
          data-testid="journal-reflection"
        >
          <h2 className="font-heading font-bold text-[#E8EDE3]" data-testid="journal-reflection-title">
            {t("journal.detail.summary.title")}
          </h2>
          <p className="text-sm text-[#C8D5B9]" data-testid="journal-reflection-saved">
            {t("journal.detail.summary.saved")}
          </p>
          {reflection.direction === "missing" ? (
            <p className="text-sm text-[#A3B197]" data-testid="journal-reflection-mood">
              {t("journal.detail.summary.moodMissing")}
            </p>
          ) : (
            <>
              <p className="text-sm text-[#C8D5B9]" data-testid="journal-reflection-mood">
                {t("journal.form.done.mood", {
                  before: reflection.before ?? "",
                  after: reflection.after ?? "",
                })}
                {changeKey ? ` · ${t(changeKey, { value: reflection.change ?? 0 })}` : ""}
              </p>
              {moodMessageKey && (
                <p className="text-sm text-[#A3B197] leading-relaxed" data-testid="journal-reflection-message">
                  {t(moodMessageKey)}
                </p>
              )}
            </>
          )}
          <div>
            <p className="text-xs text-[#7A8A72] mb-1" data-testid="journal-reflection-perspective-label">
              {reflection.perspective
                ? t("journal.detail.summary.perspectiveLabel")
                : t("journal.detail.summary.perspectiveMissing")}
            </p>
            {reflection.perspective && (
              <p
                className="text-sm text-[#C8D5B9] leading-relaxed whitespace-pre-wrap"
                data-testid="journal-reflection-perspective"
              >
                {reflection.perspective}
              </p>
            )}
          </div>
          <div className="pt-1">
            <p className="text-xs text-[#8FA680] mb-2">{t("journal.detail.summary.next")}</p>
            <button
              type="button"
              onClick={() => openBlankIntention()}
              className="h-11 px-4 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors"
              data-testid="button-create-intention"
            >
              {t("journal.detail.summary.createIntention")}
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
