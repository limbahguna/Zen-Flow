import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/BottomNav";
import { ActiveProgramPanel } from "@/components/programs/ActiveProgramPanel";
import { ProgramCard } from "@/components/programs/ProgramCard";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  useAbandonWellnessProgram,
  useActiveWellnessEnrollment,
} from "@/hooks/useWellnessProgram";
import { PROGRAM_LIST, getProgram } from "@/lib/wellness/programCatalog";
import { isProgramSlug } from "@/lib/wellness/types";

export default function ProgramsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const enrollmentQuery = useActiveWellnessEnrollment();
  const abandon = useAbandonWellnessProgram();

  const enrollment = enrollmentQuery.data ?? null;
  const activeSlug =
    enrollment && isProgramSlug(enrollment.program_slug) ? enrollment.program_slug : null;

  return (
    <motion.div
      className="min-h-screen bg-background pb-24"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <header className="sticky top-0 z-10 border-b border-[#2D3A2E] bg-[#141814]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => setLocation("/dashboard")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A3B197] hover:bg-[#222822]"
            aria-label={t("common.back")}
            data-testid="programs-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-heading text-lg font-bold text-[#E8EDE3]">
            {t("programs.page.title")}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-8">
        <section className="text-center">
          <h2 className="font-heading text-2xl font-bold text-[#E8EDE3]">
            {t("programs.page.title")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#A3B197]">
            {t("programs.page.subtitle")}
          </p>
        </section>

        {!user && (
          <div
            className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center text-sm text-[#D4806A]"
            role="alert"
            data-testid="programs-auth-error"
          >
            {t("programs.error.auth")}
          </div>
        )}

        {user && enrollmentQuery.isLoading && (
          <div className="flex justify-center py-8" data-testid="programs-loading">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8FA680] border-t-transparent" />
          </div>
        )}

        {user && enrollmentQuery.isError && (
          <div
            className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center"
            role="alert"
            data-testid="programs-error"
          >
            <p className="text-sm text-[#D4806A]">{t("programs.error.network")}</p>
            <button
              type="button"
              onClick={() => void enrollmentQuery.refetch()}
              className="mt-2 text-sm font-medium text-[#C8D5B9]"
              aria-label={t("programs.error.retry")}
              data-testid="programs-retry"
            >
              {t("programs.error.retry")}
            </button>
          </div>
        )}

        {user && enrollment && activeSlug && (
          <ActiveProgramPanel
            enrollment={enrollment}
            abandoning={abandon.isPending}
            onContinue={() => setLocation("/daily-plan")}
            onViewProgress={() => setLocation("/progress")}
            onAbandon={() => {
              abandon.mutate(enrollment.id, {
                onSuccess: () => {
                  toast({ title: t("programs.active.abandoned") });
                },
                onError: () => {
                  toast({ title: t("programs.error.abandon"), variant: "destructive" });
                },
              });
            }}
          />
        )}

        {user && !enrollmentQuery.isLoading && !enrollment && (
          <div data-testid="programs-empty-active" className="sr-only">
            {t("programs.dashboard.choose")}
          </div>
        )}

        {PROGRAM_LIST.length === 0 ? (
          <div
            className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] px-4 py-8 text-center"
            data-testid="programs-empty"
          >
            <p className="font-heading text-lg text-[#E8EDE3]">{t("programs.empty.title")}</p>
            <p className="mt-2 text-sm text-[#A3B197]">{t("programs.empty.body")}</p>
          </div>
        ) : (
          <section className="grid gap-4" data-testid="programs-grid">
            {PROGRAM_LIST.map((program) => (
              <ProgramCard
                key={program.slug}
                program={getProgram(program.slug)}
                onView={() => setLocation(`/programs/${program.slug}`)}
              />
            ))}
          </section>
        )}
      </main>
      <BottomNav />
    </motion.div>
  );
}
