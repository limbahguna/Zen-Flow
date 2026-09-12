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

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
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
  /** Translate a UI key in the currently active language. */
  t: (key: string) => string;
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

  // Plain function — no useCallback — so it's always fresh, never stale.
  function setLanguage(lang: LanguageCode) {
    if (!isSupportedLanguage(lang)) return; // allowlist guard
    try { localStorage.setItem("mindful_language", lang); } catch { /* storage denied */ }
    setLanguageState(lang);
  }

  // Plain function — closes over `language` from the current render,
  // so consumers always call t() with the latest language value.
  function t(key: string): string {
    return translate(language, key);
  }

  // Inline value object: new reference every render → all consumers
  // re-render whenever language (or any other dep) changes.
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
