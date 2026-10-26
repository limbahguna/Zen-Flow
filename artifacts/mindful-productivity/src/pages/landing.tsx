import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Bot, Leaf, Moon, NotebookPen, Sparkles, Timer, Wind } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { LanguageCode } from "@/lib/translations";
import {
  LANDING_LANGUAGE_OPTIONS,
  getStoredLandingLanguage,
  isLandingLanguage,
  isLandingRtl,
  landingText,
  storeLandingLanguage,
  type LandingCopyKey,
  type LandingLanguage,
} from "@/lib/landingCopy";

function syncAppLanguage(lang: LandingLanguage, setLanguage: (code: LanguageCode) => void) {
  if (lang === "en" || lang === "id" || lang === "ja") {
    setLanguage(lang);
  }
}

function AuthLink({
  children,
  className,
  testId,
}: {
  children: React.ReactNode;
  className: string;
  testId: string;
}) {
  return (
    <Link href="/auth" className={className} data-testid={testId}>
      {children}
    </Link>
  );
}

const FEATURES: {
  key: "mood" | "intentions" | "journal" | "practice" | "sleep" | "programs" | "companion";
  icon: typeof Leaf;
}[] = [
  { key: "mood", icon: Sparkles },
  { key: "intentions", icon: Leaf },
  { key: "journal", icon: NotebookPen },
  { key: "practice", icon: Wind },
  { key: "sleep", icon: Moon },
  { key: "programs", icon: Timer },
  { key: "companion", icon: Bot },
];

const linkClass =
  "rounded-lg px-2 py-1 text-sm text-[#C5D0BB] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8D5B9]";

const primaryCtaClass =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-[#D7E3C8] px-6 text-sm font-semibold tracking-wide text-[#1A1E1A] transition-colors hover:bg-[#E8EDE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8D5B9]";

const secondaryCtaClass =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-[#E8EDE3]/35 bg-transparent px-6 text-sm font-medium text-[#E8EDE3] transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8D5B9]";

export default function LandingPage() {
  const { language: appLanguage, setLanguage } = useLanguage();
  const [lang, setLang] = useState<LandingLanguage>(() =>
    getStoredLandingLanguage(isLandingLanguage(appLanguage) ? appLanguage : "en"),
  );

  const t = (key: LandingCopyKey) => landingText(lang, key);
  const rtl = isLandingRtl(lang);

  useEffect(() => {
    document.title = t("meta.title");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("meta.description"));
    return () => {
      document.title = "Mindful Space";
    };
  }, [lang]);

  function onLanguageChange(next: string) {
    if (!isLandingLanguage(next)) return;
    setLang(next);
    storeLandingLanguage(next);
    syncAppLanguage(next, setLanguage);
  }

  return (
    <div
      className="min-h-screen bg-[#141814] text-[#E8EDE3]"
      dir={rtl ? "rtl" : "ltr"}
      lang={lang}
      data-testid="landing-page"
    >
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[#D7E3C8] focus:px-3 focus:py-2 focus:text-[#1A1E1A]"
      >
        {t("nav.skip")}
      </a>

      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center md:px-8">
          <a
            href="#landing-main"
            className="flex min-w-0 items-center gap-2 rounded-lg text-[#E8EDE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8D5B9]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8EDE3]/10 ring-1 ring-[#E8EDE3]/20" aria-hidden="true">
              <Leaf className="h-4 w-4 text-[#D7E3C8]" />
            </span>
            <span className="truncate font-heading text-base font-semibold">Mindful Space</span>
          </a>

          <nav className="order-3 hidden w-full items-center gap-1 sm:order-none sm:flex sm:w-auto sm:flex-1 sm:justify-center" aria-label="Mindful Space">
            <a href="#features" className={linkClass}>{t("nav.features")}</a>
            <a href="#how" className={linkClass}>{t("nav.how")}</a>
          </nav>

          <div className="flex items-center justify-between gap-3 sm:ms-auto">
            <label className="sr-only" htmlFor="landing-language-selector">
              {t("nav.language")}
            </label>
            <select
              id="landing-language-selector"
              data-testid="landing-language-selector"
              value={lang}
              onChange={(event) => onLanguageChange(event.target.value)}
              className="h-10 w-[9.75rem] shrink-0 rounded-full border border-white/15 bg-[#1A1E1A]/70 px-3 text-sm text-[#E8EDE3] outline-none backdrop-blur-md focus-visible:ring-2 focus-visible:ring-[#C8D5B9]/50"
            >
              {LANDING_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <AuthLink className={`${secondaryCtaClass} min-h-10 px-4 text-sm`} testId="landing-nav-login">
              {t("nav.login")}
            </AuthLink>
          </div>
        </div>
      </header>

      <main id="landing-main">
        <section className="relative min-h-[34rem] overflow-hidden md:min-h-[42rem]">
          <img
            src="/landing/hero-forest.jpg"
            alt={t("hero.visualLabel")}
            width={1400}
            height={933}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[#141814]/55" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141814] via-[#141814]/45 to-[#141814]/20" />
          <div className="relative mx-auto flex min-h-[34rem] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 md:min-h-[42rem] md:px-8 md:pb-24">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D7E3C8]">
              {t("hero.eyebrow")}
            </p>
            <h1 className="mt-4 max-w-3xl text-balance font-heading text-4xl font-semibold leading-[1.2] text-white sm:text-5xl lg:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#D5DDCE] sm:text-lg">
              {t("hero.lead")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <AuthLink className={primaryCtaClass} testId="landing-hero-cta">
                {t("hero.cta")}
              </AuthLink>
              <AuthLink className={secondaryCtaClass} testId="landing-hero-login">
                {t("hero.secondary")}
              </AuthLink>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-[1.1fr_0.9fr] md:px-8">
          <div>
            <h2 className="font-heading text-3xl font-semibold leading-tight sm:text-4xl">{t("who.title")}</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#B7C4AD]">{t("who.body")}</p>
          </div>
          <div className="overflow-hidden rounded-[2rem] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <img
              src="/landing/practice-light.jpg"
              alt={t("who.photoAlt")}
              width={900}
              height={1350}
              className="h-[22rem] w-full object-cover md:h-[28rem]"
            />
          </div>
        </section>

        <section id="features" className="border-y border-white/5 bg-[#101410] px-4 py-20 md:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-heading text-3xl font-semibold sm:text-4xl">{t("features.title")}</h2>
            <p className="mt-3 max-w-2xl text-[#B7C4AD]">{t("features.lead")}</p>
            <ul className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.key} className="max-w-sm">
                    <Icon className="h-5 w-5 text-[#8FA680]" aria-hidden="true" />
                    <h3 className="mt-4 font-heading text-xl font-semibold">
                      {t(`features.${feature.key}.title`)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#A3B197]">
                      {t(`features.${feature.key}.body`)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-20 md:px-8">
          <h2 className="font-heading text-3xl font-semibold sm:text-4xl">{t("how.title")}</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {(["1", "2", "3"] as const).map((step) => (
              <li key={step} className="relative">
                <p className="font-heading text-5xl font-semibold text-[#2D3A2E]">{step}</p>
                <h3 className="mt-3 font-heading text-xl font-semibold">{t(`how.${step}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#A3B197]">{t(`how.${step}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="px-4 pb-20 md:px-8">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#1E261E] px-6 py-16 text-center md:px-16">
            <h2 className="font-heading text-3xl font-semibold sm:text-4xl">{t("close.title")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-[#B7C4AD]">{t("close.body")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <AuthLink className={primaryCtaClass} testId="landing-close-cta">
                {t("close.cta")}
              </AuthLink>
              <AuthLink className={`${secondaryCtaClass} border-[#E8EDE3]/20`} testId="landing-close-login">
                {t("hero.secondary")}
              </AuthLink>
            </div>
            <p className="mx-auto mt-10 max-w-2xl text-sm leading-relaxed text-[#7A8A72]">
              {t("disclaimer")}
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 px-4 py-10 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-[#7A8A72]">{t("footer.tagline")}</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label={t("footer.nav")}>
            <Link href="/privacy" className={linkClass}>{t("footer.privacy")}</Link>
            <Link href="/terms" className={linkClass}>{t("footer.terms")}</Link>
            <Link href="/crisis" className={linkClass}>{t("footer.crisis")}</Link>
            <Link href="/delete-account" className={linkClass}>{t("footer.account")}</Link>
            <Link href="/auth" className={linkClass} data-testid="landing-footer-login">
              {t("footer.login")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
