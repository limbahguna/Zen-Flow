import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { BottomNav } from "@/components/BottomNav";
import { WellnessPreferencesForm } from "@/components/programs/WellnessPreferencesForm";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  useAbandonWellnessProgram,
  useActiveWellnessEnrollment,
  useEnrollWellnessProgram,
  useSaveWellnessPreferences,
  useWellnessPreferences,
} from "@/hooks/useWellnessProgram";
import { t as translate } from "@/lib/translations";
import { isAnotherProgramActiveError } from "@/lib/wellness/errors";
import {
  PRACTICE_CONTENT_KEYS,
  getProgram,
  programDailyMinutes,
  programPracticeKinds,
} from "@/lib/wellness/programCatalog";
import { isProgramSlug, type WellnessLocale } from "@/lib/wellness/types";

export default function ProgramDetailPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/programs/:slug");
  const rawSlug = params?.slug ?? "";
  const slug = isProgramSlug(rawSlug) ? rawSlug : null;
  const program = slug ? getProgram(slug) : null;

  const prefsQuery = useWellnessPreferences();
  const enrollmentQuery = useActiveWellnessEnrollment();
  const savePrefs = useSaveWellnessPreferences();
  const enroll = useEnrollWellnessProgram();
  const abandon = useAbandonWellnessProgram();
  const [conflictOpen, setConflictOpen] = useState(false);

  const localeDefault: WellnessLocale =
    language === "id" || language === "ja" ? language : "en";

  function handleEnroll() {
    if (!slug || enroll.isPending) return;
    enroll.mutate(slug, {
      onSuccess: (result) => {
        toast({
          title: result.already_active
            ? t("programs.enroll.alreadyActive")
            : t("programs.enroll.success"),
        });
        setLocation("/programs");
      },
      onError: (error) => {
        if (isAnotherProgramActiveError(error)) {
          setConflictOpen(true);
          return;
        }
        toast({ title: t("programs.error.enroll"), variant: "destructive" });
      },
    });
  }

  const dailyMinutes = program ? programDailyMinutes(program) : 0;
  const practices = program ? programPracticeKinds(program) : [];
  const needsPrefs = Boolean(user) && prefsQuery.isSuccess && !prefsQuery.data;
  const sameProgramActive =
    enrollmentQuery.data &&
    slug &&
    enrollmentQuery.data.program_slug === slug;

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
            onClick={() => setLocation("/programs")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A3B197] hover:bg-[#222822]"
            aria-label={t("common.back")}
            data-testid="program-detail-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-heading text-lg font-bold text-[#E8EDE3]">
            {program ? t(program.titleKey) : t("programs.page.title")}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-8">
        {!user && (
          <div
            className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center text-sm text-[#D4806A]"
            role="alert"
            data-testid="programs-auth-error"
          >
            {t("programs.error.auth")}
          </div>
        )}

        {!program && (
          <div
            className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] px-4 py-8 text-center"
            data-testid="programs-empty"
          >
            <p className="font-heading text-lg text-[#E8EDE3]">{t("programs.empty.title")}</p>
            <p className="mt-2 text-sm text-[#A3B197]">{t("programs.empty.body")}</p>
          </div>
        )}

        {program && (
          <>
            <section data-testid="program-detail">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">
                {translate(language, "programs.durationDays", { count: program.durationDays })}
              </p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-[#E8EDE3]">
                {t(program.titleKey)}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#A3B197]">
                {t(program.benefitKey)}
              </p>
              <p className="mt-3 text-sm text-[#C8D5B9]">
                {t("programs.goal.label")}: {t(`programs.goal.${program.goal}`)}
              </p>
              <p className="mt-2 text-sm text-[#A3B197]" data-testid="program-daily-minutes">
                {translate(language, "programs.dailyMinutes", { minutes: dailyMinutes })}
              </p>
            </section>

            <section className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5">
              <h3 className="font-heading text-base font-semibold text-[#E8EDE3]">
                {t("programs.detail.eachDay")}
              </h3>
              <ul className="mt-3 space-y-2" data-testid="program-daily-practices">
                {practices.map((kind) => (
                  <li key={kind} className="text-sm text-[#C8D5B9]">
                    {t(PRACTICE_CONTENT_KEYS[kind])}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {user && (prefsQuery.isLoading || enrollmentQuery.isLoading) && (
          <div className="flex justify-center py-6" data-testid="programs-loading">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8FA680] border-t-transparent" />
          </div>
        )}

        {user && (prefsQuery.isError || enrollmentQuery.isError) && (
          <div
            className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center"
            role="alert"
            data-testid="programs-error"
          >
            <p className="text-sm text-[#D4806A]">{t("programs.error.network")}</p>
            <button
              type="button"
              onClick={() => {
                void prefsQuery.refetch();
                void enrollmentQuery.refetch();
              }}
              className="mt-2 text-sm font-medium text-[#C8D5B9]"
              data-testid="programs-retry"
            >
              {t("programs.error.retry")}
            </button>
          </div>
        )}

        {program && needsPrefs && (
          <WellnessPreferencesForm
            saving={savePrefs.isPending}
            defaultLocale={localeDefault}
            errorMessage={savePrefs.isError ? t("programs.error.savePrefs") : null}
            onSave={(input) => {
              savePrefs.mutate(input, {
                onSuccess: () => toast({ title: t("programs.prefs.saved") }),
              });
            }}
          />
        )}

        {program && user && prefsQuery.data && !sameProgramActive && (
          <button
            type="button"
            onClick={handleEnroll}
            disabled={enroll.isPending}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#4A5D3E] text-sm font-medium text-[#E8EDE3] hover:bg-[#6B8C5A] disabled:opacity-60"
            aria-label={t("programs.detail.start")}
            data-testid="program-start"
          >
            {enroll.isPending ? t("programs.detail.starting") : t("programs.detail.start")}
          </button>
        )}

        {conflictOpen && (
          <div
            className="rounded-2xl border border-[#4D3020] bg-[#2D2420] p-4"
            role="alert"
            data-testid="program-conflict"
          >
            <p className="font-heading text-base font-semibold text-[#E8EDE3]">
              {t("programs.enroll.conflictTitle")}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#A3B197]">
              {t("programs.enroll.conflictBody")}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#4A5D3E] text-sm font-medium text-[#E8EDE3]"
                data-testid="program-conflict-continue"
                onClick={() => setLocation("/daily-plan")}
              >
                {t("programs.enroll.continueCurrent")}
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#4D3020] text-sm font-medium text-[#D4806A]"
                data-testid="program-conflict-abandon"
                disabled={abandon.isPending || !enrollmentQuery.data}
                onClick={() => {
                  const current = enrollmentQuery.data;
                  if (!current) return;
                  abandon.mutate(current.id, {
                    onSuccess: () => {
                      setConflictOpen(false);
                      toast({ title: t("programs.active.abandoned") });
                    },
                    onError: () => {
                      toast({ title: t("programs.error.abandon"), variant: "destructive" });
                    },
                  });
                }}
              >
                {t("programs.enroll.abandonThenRetry")}
              </button>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </motion.div>
  );
}
