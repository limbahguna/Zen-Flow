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
    <Link
      href="/auth"
      className={className}
      data-testid={testId}
    >
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
  "rounded-lg px-2 py-1 text-sm text-[#A3B197] transition-colors hover:text-[#E8EDE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FA680]";

const primaryCtaClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-[#C8D5B9] px-5 text-sm font-semibold text-[#1A1E1A] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FA680]";

const secondaryCtaClass =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-[#3D4D35] bg-transparent px-5 text-sm font-medium text-[#E8EDE3] transition-colors hover:bg-[#222822] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FA680]";

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
      className="min-h-screen bg-[#1A1E1A] text-[#E8EDE3]"
      dir={rtl ? "rtl" : "ltr"}
      lang={lang}
      data-testid="landing-page"
    >
      <a
        href="#landing-main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#C8D5B9] focus:px-3 focus:py-2 focus:text-[#1A1E1A]"
      >
        {t("nav.skip")}
      </a>

      <header className="sticky top-0 z-20 border-b border-[#2D3A2E] bg-[#1A1E1A]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <a href="#landing-main" className="flex min-w-0 items-center gap-2 text-[#E8EDE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8FA680] rounded-lg">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#2D3A2E] bg-[#222822]" aria-hidden="true">
              <Leaf className="h-4 w-4 text-[#8FA680]" />
            </span>
            <span className="truncate font-heading text-base font-semibold">Mindful Space</span>
          </a>

          <nav className="order-3 hidden w-full items-center gap-1 sm:order-none sm:flex sm:w-auto sm:flex-1 sm:justify-center" aria-label="Mindful Space">
            <a href="#features" className={linkClass}>{t("nav.features")}</a>
            <a href="#how" className={linkClass}>{t("nav.how")}</a>
          </nav>

          <div className="ms-auto flex min-w-0 items-center gap-2">
            <label className="sr-only" htmlFor="landing-language-selector">
              {t("nav.language")}
            </label>
            <select
              id="landing-language-selector"
              data-testid="landing-language-selector"
              value={lang}
              onChange={(event) => onLanguageChange(event.target.value)}
              className="h-10 w-[9.75rem] shrink-0 rounded-xl border border-[#2D3A2E] bg-[#222822] px-2 text-sm text-[#C8D5B9] outline-none focus-visible:ring-2 focus-visible:ring-[#8FA680]/40"
            >
              {LANDING_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
            <AuthLink className={`${secondaryCtaClass} min-h-10 shrink-0 whitespace-nowrap px-3 text-sm`} testId="landing-nav-login">
              {t("nav.login")}
            </AuthLink>
          </div>
        </div>
      </header>

      <main id="landing-main">
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8FA680]">
              {t("hero.eyebrow")}
            </p>
            <h1 className="font-heading text-4xl font-semibold leading-tight text-[#E8EDE3] sm:text-5xl">
              {t("hero.title")}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#A3B197] sm:text-lg">
              {t("hero.lead")}
            </p>
            <div className="flex flex-wrap gap-3">
              <AuthLink className={primaryCtaClass} testId="landing-hero-cta">
                {t("hero.cta")}
              </AuthLink>
              <AuthLink className={secondaryCtaClass} testId="landing-hero-login">
                {t("hero.secondary")}
              </AuthLink>
            </div>
          </div>

          <div
            className="relative mx-auto aspect-square w-full max-w-md"
            role="img"
            aria-label={t("hero.visualLabel")}
          >
            <div className="absolute inset-8 rounded-full bg-[#8FA680]/10 blur-2xl" />
            <div className="absolute inset-16 rounded-full border border-[#3D4D35]/80" />
            <svg viewBox="0 0 160 160" className="relative h-full w-full" aria-hidden="true">
              <circle cx="80" cy="80" r="54" fill="#222822" stroke="#2D3A2E" />
              <path
                d="M80 36C80 36 48 58 48 92C48 110 62 124 80 124C98 124 112 110 112 92C112 58 80 36 80 36Z"
                fill="#8FA680"
              />
              <path d="M80 124V88" stroke="#1A1E1A" strokeWidth="2" strokeLinecap="round" />
              <path d="M80 102L66 88" stroke="#1A1E1A" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M80 94L96 78" stroke="#1A1E1A" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
        </section>

        <section className="border-y border-[#2D3A2E] bg-[#161A16]">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="font-heading text-2xl font-semibold sm:text-3xl">{t("who.title")}</h2>
            <p className="mt-4 text-base leading-relaxed text-[#A3B197]">{t("who.body")}</p>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-5xl px-4 py-16">
          <div className="max-w-2xl">
            <h2 className="font-heading text-2xl font-semibold sm:text-3xl">{t("features.title")}</h2>
            <p className="mt-3 text-[#A3B197]">{t("features.lead")}</p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <li
                  key={feature.key}
                  className="rounded-2xl border border-[#2D3A2E] bg-[#222822] p-5"
                >
                  <Icon className="h-5 w-5 text-[#8FA680]" aria-hidden="true" />
                  <h3 className="mt-3 font-heading text-lg font-semibold">
                    {t(`features.${feature.key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#A3B197]">
                    {t(`features.${feature.key}.body`)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="how" className="border-y border-[#2D3A2E] bg-[#161A16]">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="font-heading text-2xl font-semibold sm:text-3xl">{t("how.title")}</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {(["1", "2", "3"] as const).map((step) => (
                <li key={step} className="rounded-2xl border border-[#2D3A2E] bg-[#1A1E1A] p-5">
                  <p className="text-xs font-semibold tracking-widest text-[#8FA680]">{step}</p>
                  <h3 className="mt-3 font-heading text-lg font-semibold">
                    {t(`how.${step}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#A3B197]">
                    {t(`how.${step}.body`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="font-heading text-3xl font-semibold">{t("close.title")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-[#A3B197]">{t("close.body")}</p>
          <div className="mt-8 flex justify-center">
            <AuthLink className={primaryCtaClass} testId="landing-close-cta">
              {t("close.cta")}
            </AuthLink>
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-sm leading-relaxed text-[#7A8A72]">
            {t("disclaimer")}
          </p>
        </section>
      </main>

      <footer className="border-t border-[#2D3A2E] px-4 py-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
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
