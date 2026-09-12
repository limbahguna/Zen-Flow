import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGE_OPTIONS, type LanguageCode } from "@/lib/translations";

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="w-full max-w-[220px]">
      <label
        htmlFor="public-language-selector"
        className="mb-1.5 block text-right text-xs font-medium text-[#A3B197]"
      >
        {t("auth.language.label")}
      </label>
      <select
        id="public-language-selector"
        value={language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        aria-label={t("auth.language.ariaLabel")}
        data-testid="language-selector"
        className="h-10 w-full rounded-xl border border-[#2D3A2E] bg-[#222822] px-3 text-sm text-[#C8D5B9] outline-none transition-colors focus:border-[#8FA680] focus:ring-2 focus:ring-[#8FA680]/30"
      >
        {LANGUAGE_OPTIONS.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}