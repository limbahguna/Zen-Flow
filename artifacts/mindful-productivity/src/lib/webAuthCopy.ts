import {
  LANGUAGE_OPTIONS,
  isSupportedLanguage,
  t,
  type LanguageCode,
} from "@/lib/translations";

/** @deprecated Arabic is a first-class LanguageCode; kept for call-site compatibility. */
export const WEB_AUTH_ARABIC = "ar" as const;

export type WebAuthLanguage = LanguageCode;

export const WEB_ARABIC_OPTION = {
  code: "ar" as const,
  flag: "🇸🇦",
  label: "العربية",
} as const;

export function webAuthLanguageOptions(_native: boolean) {
  return LANGUAGE_OPTIONS;
}

export function isWebAuthLanguage(value: unknown): value is WebAuthLanguage {
  return isSupportedLanguage(value);
}

export function webAuthText(
  lang: WebAuthLanguage,
  key: string,
  fallback: (key: string) => string,
): string {
  if (isSupportedLanguage(lang)) {
    const translated = t(lang, key);
    if (translated !== key) return translated;
  }
  return fallback(key);
}
