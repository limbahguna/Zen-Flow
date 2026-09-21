import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { t as translate } from "@/lib/translations";
import { useActiveWellnessEnrollment } from "@/hooks/useWellnessProgram";
import { getProgram } from "@/lib/wellness/programCatalog";
import { isProgramSlug } from "@/lib/wellness/types";

export function DashboardProgramCard() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { data: enrollment, isLoading, isError, refetch } = useActiveWellnessEnrollment();

  if (isLoading) {
    return (
      <div
        className="flex justify-center rounded-2xl border border-[#2D3A2E] bg-[#222822] py-6"
        data-testid="dashboard-program-loading"
      >
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#8FA680] border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center"
        role="alert"
        data-testid="dashboard-program-error"
      >
        <p className="text-sm text-[#D4806A]">{t("programs.error.network")}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 text-sm font-medium text-[#C8D5B9]"
          aria-label={t("programs.error.retry")}
        >
          {t("programs.error.retry")}
        </button>
      </div>
    );
  }

  const slug = enrollment && isProgramSlug(enrollment.program_slug) ? enrollment.program_slug : null;
  const program = slug ? getProgram(slug) : null;

  if (enrollment && program) {
    return (
      <button
        type="button"
        onClick={() => setLocation("/daily-plan")}
        className="w-full rounded-2xl border border-[#3D4D35] bg-[#222822] p-4 text-left"
        aria-label={`${t(program.titleKey)}. ${translate(language, "programs.active.dayOf", {
          day: enrollment.current_day,
          total: program.durationDays,
        })}`}
        data-testid="dashboard-program-card"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">
              {t("programs.active.eyebrow")}
            </p>
            <h2 className="mt-1 font-heading text-lg font-semibold text-[#E8EDE3]">
              {t(program.titleKey)}
            </h2>
            <p className="mt-1 text-sm text-[#A3B197]" data-testid="dashboard-program-day">
              {translate(language, "programs.active.dayOf", {
                day: enrollment.current_day,
                total: program.durationDays,
              })}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#7A8A72]" />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLocation("/programs")}
      className="w-full rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4 text-left"
      aria-label={t("programs.dashboard.choose")}
      data-testid="dashboard-program-card"
    >
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">
        {t("programs.dashboard.choose")}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#A3B197]">
        {t("programs.dashboard.body")}
      </p>
      <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#C8D5B9]">
        {t("programs.dashboard.cta")}
        <ChevronRight className="h-4 w-4" />
      </p>
    </button>
  );
}
