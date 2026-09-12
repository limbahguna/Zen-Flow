import { Phone, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface ResourceProps {
  country: string;
  name: string;
  number: string;
  instruction: string;
}

function Resource({ country, name, number, instruction }: ResourceProps) {
  return (
    <a
      href={`tel:${number.replace(/\s/g, "")}`}
      className="flex items-center justify-between p-5 rounded-2xl bg-[#1E3020] border border-[#2D3A2E] hover:bg-[#2A4030] active:bg-[#2A4030] transition-colors duration-200 group"
      data-testid={`crisis-resource-${country.toLowerCase()}`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#7AC47A]/60">{country}</p>
        <p className="text-[#E8EDE3] font-heading font-bold text-base mt-0.5">{name}</p>
        <p className="text-[#A3B197] text-sm mt-0.5">{instruction}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <span className="text-[#E8EDE3] font-bold text-xl tabular-nums">{number}</span>
        <div className="w-10 h-10 rounded-full bg-[#2D3A2E] group-hover:bg-[#3D4D35] flex items-center justify-center transition-colors">
          <Phone className="w-5 h-5 text-[#7AC47A]" />
        </div>
      </div>
    </a>
  );
}

export default function CrisisPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[#2D3A2E] sticky top-0 z-10 bg-[#141814]/90 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-[#1E241E] transition-colors"
            data-testid="button-back-crisis"
            aria-label={t("delete.nav.back")}
          >
            <ArrowLeft className="w-5 h-5 text-[#A3B197]" />
          </button>
          <h1 className="font-heading font-bold text-base text-[#E8EDE3]">{t("crisis.title")}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-3 py-4">
          <p className="text-2xl font-heading font-bold text-[#E8EDE3]">{t("crisis.heading")}</p>
          <p className="text-[#A3B197] leading-relaxed max-w-sm mx-auto">
            {t("crisis.body")}
          </p>
        </div>

        <div className="space-y-3">
          <Resource
            country="USA"
            name={t("crisis.usa.name")}
            number="988"
            instruction={t("crisis.usa.instruction")}
          />
          <Resource
            country="UK"
            name={t("crisis.uk.name")}
            number="116 123"
            instruction={t("crisis.uk.instruction")}
          />
          <Resource
            country="Canada"
            name={t("crisis.canada.name")}
            number="988"
            instruction={t("crisis.canada.instruction")}
          />
          <Resource
            country="Australia"
            name={t("crisis.australia.name")}
            number="13 11 14"
            instruction={t("crisis.australia.instruction")}
          />
          <div className="p-5 rounded-2xl bg-[#222822] border border-[#2D3A2E]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7AC47A]/60">{t("crisis.international.label")}</p>
            <p className="text-[#E8EDE3] font-heading font-bold text-base mt-0.5">{t("crisis.international.name")}</p>
            <p className="text-[#A3B197] text-sm mt-0.5">{t("crisis.international.instruction")}</p>
          </div>
        </div>

        <div className="pt-4 text-center">
          <p className="text-[#7A8A72] text-xs">
            {t("crisis.emergency")}
          </p>
        </div>
      </main>
    </div>
  );
}
