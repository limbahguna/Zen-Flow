import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLanguage } from "@/context/LanguageContext";
import { t as translate } from "@/lib/translations";
import { getProgram } from "@/lib/wellness/programCatalog";
import type { ProgramEnrollment } from "@/lib/wellness/types";
import { isProgramSlug } from "@/lib/wellness/types";

interface ActiveProgramPanelProps {
  enrollment: ProgramEnrollment;
  abandoning: boolean;
  onContinue: () => void;
  onAbandon: () => void;
  onViewProgress?: () => void;
}

export function ActiveProgramPanel({
  enrollment,
  abandoning,
  onContinue,
  onAbandon,
  onViewProgress,
}: ActiveProgramPanelProps) {
  const { t, language } = useLanguage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const slug = isProgramSlug(enrollment.program_slug) ? enrollment.program_slug : null;
  const program = slug ? getProgram(slug) : null;
  const total = program?.durationDays ?? 0;
  const day = enrollment.current_day;
  const progress = total > 0 ? Math.min(100, Math.max(0, (day / total) * 100)) : 0;

  return (
    <section
      className="rounded-2xl border border-[#3D4D35] bg-[#222822] p-5"
      data-testid="active-program-panel"
    >
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">
        {t("programs.active.eyebrow")}
      </p>
      <h2 className="mt-1 font-heading text-lg font-bold text-[#E8EDE3]">
        {program ? t(program.titleKey) : enrollment.program_slug}
      </h2>
      <p className="mt-2 text-sm text-[#C8D5B9]" data-testid="active-program-day">
        {translate(language, "programs.active.dayOf", { day, total })}
      </p>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-[#2D3A2E]"
        role="progressbar"
        aria-valuenow={day}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={translate(language, "programs.active.dayOf", { day, total })}
        data-testid="active-program-progress"
      >
        <div className="h-full rounded-full bg-[#8FA680]" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#4A5D3E] px-4 text-sm font-medium text-[#E8EDE3] hover:bg-[#6B8C5A]"
          aria-label={t("programs.active.continue")}
          data-testid="program-continue"
        >
          {t("programs.active.continue")}
        </button>
        {onViewProgress && (
          <button
            type="button"
            onClick={onViewProgress}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#3D4D35] px-4 text-sm font-medium text-[#C8D5B9] hover:bg-[#2D3A2E]"
            aria-label={t("programs.active.progress")}
            data-testid="program-view-progress"
          >
            {t("programs.active.progress")}
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={abandoning}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-[#4D3020] bg-[#2D2420] px-4 text-sm font-medium text-[#D4806A] hover:bg-[#3A2C26] disabled:opacity-60"
          aria-label={t("programs.active.abandon")}
          data-testid="program-abandon"
        >
          {t("programs.active.abandon")}
        </button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-[#2D3A2E] bg-[#1E241E] text-[#E8EDE3]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("programs.active.abandonTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-[#A3B197]">
              {t("programs.active.abandonBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-[#2D3A2E] bg-transparent text-[#A3B197]"
              data-testid="program-abandon-cancel"
            >
              {t("programs.active.abandonCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#4D3020] text-[#D4806A] hover:bg-[#5A3A28]"
              data-testid="program-abandon-confirm"
              onClick={onAbandon}
            >
              {t("programs.active.abandonConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
