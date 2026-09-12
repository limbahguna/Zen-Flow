import { useLocation } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-heading font-bold text-[#E8EDE3]">{title}</h2>
      <div className="text-sm text-[#A3B197] leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[#141814]/90 backdrop-blur-md border-b border-[#2D3A2E] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-[#1E241E] transition-colors"
            data-testid="button-back-privacy"
            aria-label={t("delete.nav.back")}
          >
            <ArrowLeft className="w-5 h-5 text-[#A3B197]" />
          </button>
          <h1 className="font-heading font-bold text-base text-[#E8EDE3]">{t("privacy.title")}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3 p-4 bg-[#2D3A2E] rounded-2xl border border-[#3D4D35]">
          <Shield className="w-6 h-6 text-[#8FA680] shrink-0" />
          <div>
            <p className="font-heading font-bold text-[#E8EDE3]">{t("privacy.heading")}</p>
            <p className="text-xs text-[#7A8A72] mt-0.5">{t("privacy.updated")}</p>
          </div>
        </div>

        <Section title={t("privacy.section.collect")}>
          <p>{t("privacy.collect.intro")}</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>{t("privacy.collect.email")}</li>
            <li>{t("privacy.collect.tasks")}</li>
            <li>{t("privacy.collect.anxiety")}</li>
            <li>{t("privacy.collect.journal")}</li>
            <li>{t("privacy.collect.fear")}</li>
            <li>{t("privacy.collect.analytics")}</li>
          </ul>
        </Section>

        <Section title={t("privacy.section.store")}>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>{t("privacy.store.supabase")}</li>
            <li>{t("privacy.store.passwords")}</li>
            <li>{t("privacy.store.https")}</li>
          </ul>
        </Section>

        <Section title={t("privacy.section.ai")}>
          <p>{t("privacy.ai.intro")}</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>{t("privacy.ai.thirdparty")}</li>
            <li>{t("privacy.ai.notpro")}</li>
            <li>{t("privacy.ai.optional")}</li>
          </ul>
        </Section>

        <Section title={t("privacy.section.thirdparty")}>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>{t("privacy.thirdparty.supabase")}</li>
            <li>{t("privacy.thirdparty.ai")}</li>
          </ul>
        </Section>

        <Section title={t("privacy.section.rights")}>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>{t("privacy.rights.deletion")}</li>
            <li>{t("privacy.rights.export")}</li>
            <li>{t("privacy.rights.individual")}</li>
            <li><strong className="text-[#C8D5B9]">{t("privacy.rights.eu")}</strong> {t("privacy.rights.eu.detail")}</li>
            <li><strong className="text-[#C8D5B9]">{t("privacy.rights.ca")}</strong> {t("privacy.rights.ca.detail")}</li>
          </ul>
        </Section>

        <Section title={t("privacy.section.retention")}>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>{t("privacy.retention.active")}</li>
            <li>{t("privacy.retention.deletion")}</li>
          </ul>
        </Section>

        <Section title={t("privacy.section.children")}>
          <p>{t("privacy.children.body")}</p>
        </Section>

        <Section title={t("privacy.section.contact")}>
          <p>{t("privacy.contact.body")}</p>
        </Section>

        <Section title={t("privacy.section.changes")}>
          <p>{t("privacy.changes.body")}</p>
        </Section>

        <div className="pt-4 border-t border-[#2D3A2E]">
          <button
            onClick={() => setLocation("/terms")}
            className="text-sm text-[#8FA680] hover:underline"
          >
            {t("privacy.link.terms")}
          </button>
        </div>
      </main>
    </div>
  );
}
