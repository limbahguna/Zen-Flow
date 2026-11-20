/**
 * LanguageContext — global language state for the entire app.
 *
 * Provides:
 *   language    – current LanguageCode (e.g. "id", "en")
 *   setLanguage – change + persist; applies RTL/lang to <html>
 *   t(key)      – look up a UI string in the current language
 *
 * Intentionally written WITHOUT useCallback / useMemo so there are
 * no stale-closure risks. t() and setLanguage() are re-created each
 * render — the tiny allocation cost is negligible next to the
 * correctness guarantee that every consumer always gets the latest value.
 *
 * Storage: localStorage key "mindful_language" (no migration needed).
 * RTL: sets document.documentElement.dir = "rtl" for Arabic, "ltr" for others.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type LanguageCode,
  getStoredLanguage,
  isSupportedLanguage,
  isRTL,
  t as translate,
} from "@/lib/translations";

// ── Context shape ─────────────────────────────────────────────────────────────
interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  /** Translate a UI key in the currently active language, filling any {placeholders}. */
  t: (key: string, values?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(getStoredLanguage);

  // Apply direction whenever language changes (including on first mount).
  useEffect(() => {
    document.documentElement.dir  = isRTL(language) ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    if (!isSupportedLanguage(lang)) return; // allowlist guard
    try { localStorage.setItem("mindful_language", lang); } catch { /* storage denied */ }
    setLanguageState(lang);
  }, []);

  // Stable across renders for the same language so notification sync effects
  // only re-run when the language actually changes.
  const t = useCallback(
    (key: string, values?: Record<string, string | number>): string =>
      translate(language, key, values),
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
