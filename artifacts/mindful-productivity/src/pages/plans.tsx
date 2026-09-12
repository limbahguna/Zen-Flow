import { ArrowLeft, Check, Crown, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/BottomNav";
import { useLanguage } from "@/context/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import { pricingRegionForDevice, type PlanId } from "@/lib/subscription";

const PLAN_ACCENTS: Record<PlanId, { color: string; background: string }> = {
  free: { color: "#A3B197", background: "#222822" },
  plus: { color: "#D4B96A", background: "#302A1C" },
  pro: { color: "#B08AD4", background: "#282035" },
};

export default function PlansPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const region = pricingRegionForDevice();
  const { data, isLoading, isError } = useSubscription(region);

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
            onClick={() => setLocation("/profile")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A3B197] hover:bg-[#222822]"
            aria-label={t("plans.back")}
            data-testid="plans-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-heading text-lg font-bold text-[#E8EDE3]">
            {t("plans.title")}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-8">
        <section className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D3A2E]">
            <Sparkles className="h-7 w-7 text-[#8FA680]" />
          </div>
          <h2 className="font-heading text-2xl font-bold text-[#E8EDE3]">
            {t("plans.heading")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#A3B197]">
            {t("plans.subtitle")}
          </p>
        </section>

        {isLoading && (
          <div className="flex justify-center py-12" data-testid="plans-loading">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8FA680] border-t-transparent" />
          </div>
        )}

        {isError && (
          <div
            className="rounded-2xl border border-[#4D3020] bg-[#2D2420] px-4 py-4 text-center text-sm text-[#D4806A]"
            role="alert"
            data-testid="plans-error"
          >
            {t("plans.error")}
          </div>
        )}

        {data && (
          <>
            <section
              className="flex items-center gap-3 rounded-2xl border border-[#2D3A2E] bg-[#1E241E] px-4 py-3"
              data-testid="active-plan"
            >
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#7AC47A]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-[#7A8A72]">
                  {t("plans.active")}
                </p>
                <p className="font-heading text-base font-bold text-[#E8EDE3]">
                  {t(`plans.plan.${data.activePlan}`)}
                </p>
              </div>
              <p className="text-right text-xs text-[#A3B197]">
                {data.usedToday}/{data.dailyLimit} {t("plans.messagesToday")}
              </p>
            </section>

            <section className="grid gap-4 md:grid-cols-3" data-testid="plans-grid">
              {data.plans.map((plan) => {
                const accent = PLAN_ACCENTS[plan.id];
                const isActive = data.activePlan === plan.id;
                const isPopular = plan.id === "plus";
                const price = plan.prices[region];
                return (
                  <article
                    key={plan.id}
                    className="relative flex flex-col rounded-2xl border p-5"
                    style={{
                      background: accent.background,
                      borderColor: isActive ? accent.color : "#2D3A2E",
                    }}
                    data-testid={`plan-card-${plan.id}`}
                  >
                    {isPopular && (
                      <div
                        className="absolute -top-3 left-4 flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
                        style={{ background: accent.color, color: "#171B17" }}
                        data-testid="most-popular"
                      >
                        <Crown className="h-3 w-3" />
                        {t("plans.mostPopular")}
                      </div>
                    )}
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-heading text-xl font-bold text-[#E8EDE3]">
                          {t(`plans.plan.${plan.id}`)}
                        </h3>
                        <p className="mt-1 text-xs text-[#A3B197]">
                          {plan.dailyAiMessages} {t("plans.aiMessagesPerDay")}
                        </p>
                      </div>
                      {isActive && (
                        <span className="rounded-full bg-[#1E3020] px-2 py-1 text-[10px] font-semibold uppercase text-[#7AC47A]">
                          {t("plans.current")}
                        </span>
                      )}
                    </div>
                    <div className="mb-5">
                      <span className="font-heading text-3xl font-bold" style={{ color: accent.color }}>
                        {price.display}
                      </span>
                      <span className="ml-1 text-xs text-[#7A8A72]">
                        {t("plans.perMonth")}
                      </span>
                    </div>
                    <ul className="flex flex-1 flex-col gap-3">
                      {plan.featureIds.map((feature) => (
                        <li key={feature} className="flex gap-2 text-sm leading-snug text-[#C8D5B9]">
                          <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent.color }} />
                          <span>{t(`plans.feature.${feature}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </section>

            {!data.billingAvailable && (
              <p className="pb-2 text-center text-xs leading-relaxed text-[#7A8A72]" data-testid="billing-note">
                {t("plans.billingNote")}
              </p>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </motion.div>
  );
}