import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import {
  categoryMeta,
  logSanitizedLessonProgressError,
  saveLessonProgress,
  type LessonRow,
} from "@/lib/lessons";

interface LessonReaderProps {
  lesson: LessonRow;
  onClose: () => void;
  markReadLabel?: string;
  onMarkRead?: () => void;
  markReadDisabled?: boolean;
  markReadDone?: boolean;
}

export function LessonReader({
  lesson,
  onClose,
  markReadLabel,
  onMarkRead,
  markReadDisabled,
  markReadDone,
}: LessonReaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const meta = categoryMeta(lesson.category);
  const Icon = meta.icon;
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleFeedback(helpful: boolean) {
    if (!user || submitting || submitted) return;
    setSubmitting(true);
    try {
      await saveLessonProgress(user.id, lesson.id, helpful);
      setSubmitted(true);
    } catch (error) {
      logSanitizedLessonProgressError(error);
      toast({
        title: t("lesson.toast.error.title"),
        description: t("lesson.toast.error.desc"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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
      aria-label={lesson.title}
      data-lesson-id={lesson.id}
    >
      <header className="sticky top-0 bg-[#141814]/90 backdrop-blur-md border-b border-[#2D3A2E]">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[#7A8A72] hover:text-[#A3B197] transition-colors"
            aria-label={t("common.back")}
            data-testid="button-lesson-back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">{t("common.back")}</span>
          </button>
        </div>
      </header>

      <article className="max-w-2xl mx-auto px-5 pt-6 pb-24">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: meta.iconBg, color: meta.iconColor }}
        >
          <Icon className="w-3.5 h-3.5" />
          {t(meta.labelKey)}
        </span>

        <h1 className="font-heading font-bold text-[#E8EDE3] mt-4 leading-snug" style={{ fontSize: "22px" }}>
          {lesson.title}
        </h1>

        <div className="flex items-center gap-1.5 text-[#7A8A72] text-sm mt-2">
          <Clock className="w-4 h-4" />
          <span>{t("learn.card.minRead").replace("{n}", String(lesson.reading_time_minutes))}</span>
        </div>

        <p
          className="mt-6 whitespace-pre-line"
          style={{ fontSize: "16px", lineHeight: 1.7, color: "#C8D5B9" }}
        >
          {lesson.content}
        </p>

        {onMarkRead && (
          <button
            type="button"
            onClick={onMarkRead}
            disabled={markReadDisabled || markReadDone}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#4A5D3E] text-sm font-medium text-[#E8EDE3] hover:bg-[#6B8C5A] disabled:opacity-60"
            data-testid="lesson-mark-read"
          >
            {markReadLabel}
          </button>
        )}

        <div className="mt-10 pt-6 border-t border-[#2D3A2E]">
          {submitted ? (
            <div className="flex items-center gap-2 text-[#7AC47A]">
              <Check className="w-5 h-5" />
              <span className="text-sm font-medium">{t("lesson.feedback.thanks")}</span>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-[#E8EDE3] mb-3">{t("lesson.feedback.question")}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleFeedback(true)}
                  disabled={submitting}
                  className="flex-1 h-11 rounded-xl border border-[#2D3A2E] bg-[#1E241E] text-sm font-medium text-[#C8D5B9] flex items-center justify-center gap-2 hover:border-[#8FA680]/40 hover:bg-[#2D3A2E] transition-all duration-300 disabled:opacity-60"
                  data-testid="button-helpful-yes"
                >
                  <ThumbsUp className="w-4 h-4" /> {t("lesson.feedback.yes")}
                </button>
                <button
                  onClick={() => handleFeedback(false)}
                  disabled={submitting}
                  className="flex-1 h-11 rounded-xl border border-[#2D3A2E] bg-[#1E241E] text-sm font-medium text-[#C8D5B9] flex items-center justify-center gap-2 hover:border-[#2D3A2E] hover:bg-[#2D3A2E] transition-all duration-300 disabled:opacity-60"
                  data-testid="button-helpful-no"
                >
                  <ThumbsDown className="w-4 h-4" /> {t("lesson.feedback.no")}
                </button>
              </div>
            </>
          )}
        </div>
      </article>
    </motion.div>
  );
}
