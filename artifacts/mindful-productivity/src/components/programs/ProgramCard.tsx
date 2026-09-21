import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { t as translate } from "@/lib/translations";
import type { ProgramDefinition } from "@/lib/wellness/programCatalog";

interface ProgramCardProps {
  program: ProgramDefinition;
  onView: () => void;
}

export function ProgramCard({ program, onView }: ProgramCardProps) {
  const { t, language } = useLanguage();

  return (
    <article
      className="flex flex-col rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5"
      data-testid={`program-card-${program.slug}`}
    >
      <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">
        {translate(language, "programs.durationDays", { count: program.durationDays })}
      </p>
      <h2 className="font-heading text-xl font-bold text-[#E8EDE3]">
        {t(program.titleKey)}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#A3B197]">
        {t(program.benefitKey)}
      </p>
      <p className="mt-3 text-xs text-[#C8D5B9]">
        {t("programs.goal.label")}: {t(`programs.goal.${program.goal}`)}
      </p>
      <button
        type="button"
        onClick={onView}
        className="mt-4 inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-[#4A5D3E] px-4 text-sm font-medium text-[#E8EDE3] hover:bg-[#6B8C5A]"
        aria-label={`${t("programs.viewProgram")}: ${t(program.titleKey)}`}
        data-testid={`program-view-${program.slug}`}
      >
        {t("programs.viewProgram")}
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}
