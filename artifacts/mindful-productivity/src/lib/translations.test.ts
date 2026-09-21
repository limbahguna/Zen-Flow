/**
 * Unit tests for translations.ts pure functions.
 *
 * Scope: EN / ID / JA launch languages only.
 * ES / DE / AR / ZH are retired and must NOT appear in SUPPORTED_LANGUAGES.
 *
 * Run:  pnpm --filter @workspace/mindful-productivity run test
 *
 * No React rendering needed — all functions are pure (localStorage or
 * document globals are faked via jsdom environment in vitest.config.ts).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getTranslationKeys,
  t,
  isRTL,
  getStoredLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_OPTIONS,
  type LanguageCode,
} from "./translations";

// ── 1. t() — translation lookup ───────────────────────────────────────────────
describe("t() — translation lookup", () => {
  it("returns English string for en", () => {
    expect(t("en", "nav.home")).toBe("Home");
  });

  it("returns Indonesian string for id", () => {
    expect(t("id", "nav.home")).toBe("Beranda");
  });

  it("returns Japanese string for ja", () => {
    expect(t("ja", "nav.home")).toBe("ホーム");
  });

  it("falls back to English when key is missing in target language", () => {
    // profile.version is in en; if missing in id, falls back to en value
    const result = t("id", "profile.version");
    expect(result).toBe("Mindful Space v1.0");
  });

  it("returns the key itself when not found in any language", () => {
    expect(t("en", "nonexistent.key.xyz")).toBe("nonexistent.key.xyz");
  });

  it("returns Indonesian greeting for each time of day", () => {
    expect(t("id", "dashboard.greeting.morning")).toBe("Selamat pagi");
    expect(t("id", "dashboard.greeting.afternoon")).toBe("Selamat siang");
    expect(t("id", "dashboard.greeting.evening")).toBe("Selamat malam");
  });

  it("returns Indonesian practice tab labels", () => {
    expect(t("id", "practice.tab.intentions")).toBe("Niat");
    expect(t("id", "practice.tab.journal")).toBe("Jurnal");
    expect(t("id", "practice.tab.lessons")).toBe("Pelajaran");
  });

  it("uses Daily Insight terminology for the dashboard lesson label", () => {
    expect(t("en", "dashboard.quickActions.lessons")).toBe("Daily Insight");
    expect(t("id", "dashboard.quickActions.lessons")).toBe("Wawasan Harian");
    expect(t("ja", "dashboard.quickActions.lessons")).toBe("デイリーインサイト");
  });

  it("returns Indonesian coach strings", () => {
    expect(t("id", "coach.placeholder")).toBe("Ceritakan apa yang ada di pikiranmu…");
    expect(t("id", "coach.emptyTitle")).toBe("Teman mindful-mu");
    expect(t("id", "coach.error.limit")).toContain("Batas pesan");
  });

  it("returns Indonesian profile strings", () => {
    expect(t("id", "profile.signOut")).toBe("Keluar");
    expect(t("id", "profile.language")).toBe("Bahasa");
    expect(t("id", "profile.languageSubtitle")).toBe("Bahasa pelatih dan konten");
  });

  it("returns Japanese nav labels", () => {
    expect(t("ja", "nav.home")).toBe("ホーム");
    expect(t("ja", "nav.practice")).toBe("練習");
    expect(t("ja", "nav.coach")).toBe("コンパニオン");
    expect(t("ja", "nav.profile")).toBe("プロフィール");
  });

  it("returns Japanese greetings", () => {
    expect(t("ja", "dashboard.greeting.morning")).toBe("おはようございます");
    expect(t("ja", "dashboard.greeting.afternoon")).toBe("こんにちは");
    expect(t("ja", "dashboard.greeting.evening")).toBe("こんばんは");
  });
});

// ── 2. isRTL() — all launch languages are LTR ─────────────────────────────────
describe("isRTL()", () => {
  it("returns false for all EN/ID/JA launch languages", () => {
    const ltr: LanguageCode[] = ["en", "id", "ja"];
    for (const lang of ltr) {
      expect(isRTL(lang)).toBe(false);
    }
  });
});

// ── 3. SUPPORTED_LANGUAGES allowlist — only en/id/ja ─────────────────────────
describe("SUPPORTED_LANGUAGES", () => {
  it("contains exactly the 3 launch language codes: en, id, ja", () => {
    const codes = Object.keys(SUPPORTED_LANGUAGES).sort();
    expect(codes).toEqual(["en", "id", "ja"]);
  });

  it("does NOT contain retired codes es, de, ar, zh", () => {
    const codes = Object.keys(SUPPORTED_LANGUAGES);
    expect(codes).not.toContain("es");
    expect(codes).not.toContain("de");
    expect(codes).not.toContain("ar");
    expect(codes).not.toContain("zh");
  });

  it("maps each code to a non-empty display name", () => {
    for (const [, name] of Object.entries(SUPPORTED_LANGUAGES)) {
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

// ── 4. LANGUAGE_OPTIONS selector — only en/id/ja selectable ──────────────────
describe("LANGUAGE_OPTIONS", () => {
  it("contains exactly 3 options", () => {
    expect(LANGUAGE_OPTIONS).toHaveLength(3);
  });

  it("option codes are exactly en, id, ja", () => {
    const codes = LANGUAGE_OPTIONS.map((o) => o.code).sort();
    expect(codes).toEqual(["en", "id", "ja"]);
  });

  it("does NOT contain es, de, ar, zh as selectable options", () => {
    const codes = LANGUAGE_OPTIONS.map((o) => o.code);
    expect(codes).not.toContain("es");
    expect(codes).not.toContain("de");
    expect(codes).not.toContain("ar");
    expect(codes).not.toContain("zh");
  });

  it("each option has a non-empty flag and label", () => {
    for (const option of LANGUAGE_OPTIONS) {
      expect(option.flag.length).toBeGreaterThan(0);
      expect(option.label.length).toBeGreaterThan(0);
    }
  });
});

// ── 5. getStoredLanguage() — localStorage persistence ────────────────────────
describe("getStoredLanguage()", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("returns 'en' when nothing is stored", () => {
    expect(getStoredLanguage()).toBe("en");
  });

  it("returns stored 'id' when stored", () => {
    localStorage.setItem("mindful_language", "id");
    expect(getStoredLanguage()).toBe("id");
  });

  it("returns stored 'ja' when stored", () => {
    localStorage.setItem("mindful_language", "ja");
    expect(getStoredLanguage()).toBe("ja");
  });

  it("returns 'en' when stored value is not in SUPPORTED_LANGUAGES (unknown 'xx')", () => {
    localStorage.setItem("mindful_language", "xx");
    expect(getStoredLanguage()).toBe("en");
  });

  it("normalizes legacy 'es' to 'en' and persists normalization", () => {
    localStorage.setItem("mindful_language", "es");
    expect(getStoredLanguage()).toBe("en");
    // After normalization the key must be overwritten to 'en'
    expect(localStorage.getItem("mindful_language")).toBe("en");
  });

  it("normalizes legacy 'de' to 'en' and persists normalization", () => {
    localStorage.setItem("mindful_language", "de");
    expect(getStoredLanguage()).toBe("en");
    expect(localStorage.getItem("mindful_language")).toBe("en");
  });

  it("normalizes legacy 'ar' to 'en' and persists normalization", () => {
    localStorage.setItem("mindful_language", "ar");
    expect(getStoredLanguage()).toBe("en");
    expect(localStorage.getItem("mindful_language")).toBe("en");
  });

  it("normalizes legacy 'zh' to 'en' and persists normalization", () => {
    localStorage.setItem("mindful_language", "zh");
    expect(getStoredLanguage()).toBe("en");
    expect(localStorage.getItem("mindful_language")).toBe("en");
  });

  it("returns 'en' when stored value is empty string", () => {
    localStorage.setItem("mindful_language", "");
    expect(getStoredLanguage()).toBe("en");
  });

  it("stores all 3 supported language codes correctly", () => {
    const codes: LanguageCode[] = ["en", "id", "ja"];
    for (const code of codes) {
      localStorage.setItem("mindful_language", code);
      expect(getStoredLanguage()).toBe(code);
    }
  });

  it("detects Indonesian from the browser when no preference is stored", () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "id-ID",
    });
    expect(getStoredLanguage()).toBe("id");
    expect(localStorage.getItem("mindful_language")).toBe("id");
  });

  it("detects Japanese from the browser when no preference is stored", () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "ja-JP",
    });
    expect(getStoredLanguage()).toBe("ja");
    expect(localStorage.getItem("mindful_language")).toBe("ja");
  });
});

// ── 6. Translation key parity across EN / ID / JA ────────────────────────────
describe("translation key parity — EN / ID / JA", () => {
  const englishKeys = getTranslationKeys("en").sort();

  it("uses exactly the same key set for Indonesian", () => {
    expect(getTranslationKeys("id").sort()).toEqual(englishKeys);
  });

  it("uses exactly the same key set for Japanese", () => {
    expect(getTranslationKeys("ja").sort()).toEqual(englishKeys);
  });
});

// ── 7. HTML language direction — always LTR for launch scope ─────────────────
describe("document RTL side-effect", () => {
  it("isRTL returns false for all EN/ID/JA — HTML stays LTR", () => {
    expect(isRTL("en")).toBe(false);
    expect(isRTL("id")).toBe(false);
    expect(isRTL("ja")).toBe(false);
  });
});
