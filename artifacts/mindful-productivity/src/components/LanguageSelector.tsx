import { useLanguage } from "@/context/LanguageContext";
import { type LanguageCode } from "@/lib/translations";
import {
  AUTH_ARABIC_COPY,
  WEB_AUTH_ARABIC,
  isWebAuthLanguage,
  webAuthLanguageOptions,
  type WebAuthLanguage,
} from "@/lib/webAuthCopy";

interface LanguageSelectorProps {
  includeArabic?: boolean;
  value?: WebAuthLanguage;
  onLanguageChange?: (language: WebAuthLanguage) => void;
}

export default function LanguageSelector({
  includeArabic = false,
  value,
  onLanguageChange,
}: LanguageSelectorProps) {
  const { language, setLanguage, t } = useLanguage();
  const options = webAuthLanguageOptions(!includeArabic);
  const selected = value ?? language;
  const arabicUi = selected === WEB_AUTH_ARABIC;
  const label = arabicUi ? AUTH_ARABIC_COPY["auth.language.label"] : t("auth.language.label");
  const ariaLabel = arabicUi
    ? AUTH_ARABIC_COPY["auth.language.ariaLabel"]
    : t("auth.language.ariaLabel");

  return (
    <div className="w-full max-w-[220px]">
      <label
        htmlFor="public-language-selector"
        className="mb-1.5 block text-start text-xs font-medium text-[#A3B197]"
      >
        {label}
      </label>
      <select
        id="public-language-selector"
        value={selected}
        onChange={(event) => {
          const next = event.target.value;
          if (!isWebAuthLanguage(next)) return;
          onLanguageChange?.(next);
          if (next !== WEB_AUTH_ARABIC) setLanguage(next as LanguageCode);
        }}
        aria-label={ariaLabel}
        data-testid="language-selector"
        className="h-10 w-full rounded-xl border border-[#2D3A2E] bg-[#222822] px-3 text-sm text-[#C8D5B9] outline-none transition-colors focus:border-[#8FA680] focus:ring-2 focus:ring-[#8FA680]/30"
      >
        {options.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
