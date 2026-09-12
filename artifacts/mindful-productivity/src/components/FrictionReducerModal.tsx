import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Scissors, Timer, ArrowLeft, Sprout } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTaskActions } from "@/hooks/useTaskActions";
import { useLanguage } from "@/context/LanguageContext";
import type { TaskRow } from "@/lib/tasks";
import { useLocation } from "wouter";

/**
 * Build the locale-aware "Just start:" prefix + first 5 words of the title.
 * The prefix itself is translated; the task words are verbatim user content.
 */
function buildSuggestion(prefix: string, title: string): string {
  const words = title.trim().split(/\s+/).slice(0, 5).join(" ");
  return `${prefix} ${words}`;
}

interface FrictionReducerModalProps {
  task: TaskRow;
  onClose: () => void;
  onShrunk: () => void;
  onCoworkStarted: () => void;
}

export function FrictionReducerModal({ task, onClose, onShrunk, onCoworkStarted }: FrictionReducerModalProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { shrink } = useTaskActions();
  const [, setLocation] = useLocation();
  const [view, setView] = useState<"choose" | "shrink" | "cowork">("choose");

  const originalTitle = task.original_title || task.title;

  // Track whether the user has manually edited the suggestion field.
  // If they have, language changes must NOT overwrite their edit.
  const [newTitle, setNewTitle] = useState(() =>
    buildSuggestion(t("friction.suggestPrefix"), originalTitle),
  );
  const userHasEdited = useRef(false);

  // When the language changes, regenerate the suggestion only if the user
  // hasn't manually edited the field yet.
  useEffect(() => {
    if (!userHasEdited.current) {
      setNewTitle(buildSuggestion(t("friction.suggestPrefix"), originalTitle));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleShrink() {
    if (!newTitle.trim()) return;
    try {
      await shrink.mutateAsync({ taskId: task.id, newTitle, originalTitle });
      toast({ title: t("friction.toast.shrink.title"), description: t("friction.toast.shrink.desc") });
      onShrunk();
    } catch {
      toast({ title: t("friction.toast.error.title"), description: t("friction.toast.error.desc"), variant: "destructive" });
    }
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
        aria-label={t("friction.ariaLabel")}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#222822] border border-[#2D3A2E] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between p-6 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {view !== "choose" && (
              <button
                onClick={() => setView("choose")}
                className="shrink-0 text-[#7A8A72] hover:text-[#A3B197] transition-colors"
                aria-label={t("common.back")}
                data-testid="button-friction-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-xl font-heading font-bold text-[#E8EDE3]">
              {view === "cowork" ? t("friction.cowork.title") : t("friction.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-[#7A8A72] hover:text-[#A3B197] transition-colors"
            aria-label={t("common.close")}
            data-testid="button-friction-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6">
          {view === "choose" && (
            <>
              <div className="flex items-start gap-3 rounded-xl bg-[#2D3A2E] p-4 mb-5">
                <Sprout className="w-5 h-5 text-[#8FA680] shrink-0 mt-0.5" />
                <p className="text-sm text-[#C8D5B9]">
                  {t("friction.intro")}
                </p>
              </div>

              <button
                onClick={() => setView("shrink")}
                className="w-full text-left p-4 rounded-xl border border-[#2D3A2E] hover:border-[#3D4D35] hover:bg-[#1E241E] transition-all duration-300 mb-3"
                data-testid="button-option-shrink"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2D3A2E] flex items-center justify-center shrink-0">
                    <Scissors className="w-5 h-5 text-[#8FA680]" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-[#E8EDE3]">{t("friction.option.shrink.title")}</p>
                    <p className="text-sm text-[#7A8A72]">{t("friction.option.shrink.desc")}</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => { onCoworkStarted(); setLocation("/focus"); }}
                className="w-full text-left p-4 rounded-xl border border-[#2D3A2E] hover:border-[#3D4D35] hover:bg-[#1E241E] transition-all duration-300"
                data-testid="button-option-cowork"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2D2410] flex items-center justify-center shrink-0">
                    <Timer className="w-5 h-5 text-[#D4B96A]" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-[#E8EDE3]">{t("friction.option.focus.title")}</p>
                    <p className="text-sm text-[#7A8A72]">{t("friction.option.focus.desc")}</p>
                  </div>
                </div>
              </button>
            </>
          )}

          {view === "shrink" && (
            <div>
              <p className="text-sm text-[#7A8A72] mb-1.5">{t("friction.shrink.originalLabel")}</p>
              <p className="text-sm text-[#7A8A72] line-through mb-4">{originalTitle}</p>

              <label htmlFor="shrink-title" className="block text-sm font-medium text-[#C8D5B9] mb-2">
                {t("friction.shrink.newLabel")}
              </label>
              <Input
                id="shrink-title"
                value={newTitle}
                onChange={(e) => {
                  userHasEdited.current = true;
                  setNewTitle(e.target.value);
                }}
                className="rounded-xl mb-4 bg-[#1A1E1A] border-[#2D3A2E] text-[#C8D5B9]"
                data-testid="input-shrink-title"
              />

              <div className="rounded-xl bg-[#1E3020] p-3.5 mb-5">
                <p className="text-sm text-[#7AC47A]">
                  {t("friction.shrink.tip")}
                </p>
              </div>

              <button
                onClick={handleShrink}
                disabled={!newTitle.trim() || shrink.isPending}
                className="w-full h-12 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors disabled:opacity-50"
                data-testid="button-save-shrink"
              >
                {shrink.isPending ? t("friction.shrink.saving") : t("friction.shrink.save")}
              </button>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
