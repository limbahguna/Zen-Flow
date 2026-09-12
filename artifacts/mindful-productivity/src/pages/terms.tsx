import { useLocation } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-heading font-bold text-[#E8EDE3]">{title}</h2>
      <div className="text-sm text-[#A3B197] leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[#141814]/90 backdrop-blur-md border-b border-[#2D3A2E] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-[#1E241E] transition-colors"
            data-testid="button-back-terms"
            aria-label={t("delete.nav.back")}
          >
            <ArrowLeft className="w-5 h-5 text-[#A3B197]" />
          </button>
          <h1 className="font-heading font-bold text-base text-[#E8EDE3]">{t("terms.title")}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3 p-4 bg-[#222822] border border-[#2D3A2E] rounded-2xl">
          <FileText className="w-6 h-6 text-[#8FA680] shrink-0" />
          <div>
            <p className="font-heading font-bold text-[#E8EDE3]">{t("terms.heading")}</p>
            <p className="text-xs text-[#7A8A72] mt-0.5">{t("terms.updated")}</p>
          </div>
        </div>

        <Section title={t("terms.section.acceptance")}>
          <p>{t("terms.acceptance.body")}</p>
        </Section>

        <Section title={t("terms.section.nature")}>
          <p>{t("terms.nature.body")}</p>
        </Section>

        <Section title={t("terms.section.notmedical")}>
          <p className="font-medium text-[#C8D5B9]">{t("terms.notmedical.strong")}</p>
          <p>{t("terms.notmedical.body")}</p>
        </Section>

        <Section title={t("terms.section.ai")}>
          <p>{t("terms.ai.intro")}</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>{t("terms.ai.accuracy")}</li>
            <li>{t("terms.ai.emergency")}</li>
            <li>{t("terms.ai.scope")}</li>
          </ul>
        </Section>

        <Section title={t("terms.section.responsibilities")}>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>{t("terms.responsibilities.professional")}</li>
            <li>{t("terms.responsibilities.nosole")}</li>
            <li>{t("terms.responsibilities.age")}</li>
            <li>{t("terms.responsibilities.security")}</li>
          </ul>
        </Section>

        <Section title={t("terms.section.liability")}>
          <p>{t("terms.liability.body")}</p>
        </Section>

        <Section title={t("terms.section.changes")}>
          <p>{t("terms.changes.body")}</p>
        </Section>

        <div className="pt-4 border-t border-[#2D3A2E]">
          <button
            onClick={() => setLocation("/privacy")}
            className="text-sm text-[#8FA680] hover:underline"
          >
            {t("terms.link.privacy")}
          </button>
        </div>
      </main>
    </div>
  );
}
