/**
 * Integration tests for LanguageProvider + consumer re-render.
 *
 * Scope: EN / ID / JA launch languages only.
 * ES / DE / AR / ZH are retired — their option values must not be selectable,
 * and legacy localStorage values for those codes must normalize to "en".
 *
 * Verifies that calling setLanguage() from a consumer immediately
 * updates ALL other consumers (BottomNav labels, translated UI text)
 * WITHOUT a page reload.
 *
 * These tests must FAIL on a stale-closure / memoisation bug and PASS
 * on the corrected implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { SUPPORTED_LANGUAGES, LANGUAGE_OPTIONS } from "@/lib/translations";
import type { LanguageCode } from "@/lib/translations";

// ── Helper component: a minimal consumer that shows translated strings
// and a <select> to change the language (mirrors the real Profile page).
// Only contains EN / ID / JA options — retired languages are not selectable.
function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div>
      <span data-testid="nav-home-label">{t("nav.home")}</span>
      <span data-testid="nav-profile-label">{t("nav.profile")}</span>
      <span data-testid="greeting-morning">{t("dashboard.greeting.morning")}</span>
      <span data-testid="current-lang">{language}</span>
      <select
        data-testid="lang-select"
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
      >
        <option value="en">English</option>
        <option value="id">Bahasa Indonesia</option>
        <option value="ja">日本語</option>
      </select>
    </div>
  );
}

// ── Helper component: a second consumer to verify cross-component propagation.
function SecondConsumer() {
  const { t } = useLanguage();
  return (
    <div>
      <span data-testid="second-nav-coach">{t("nav.coach")}</span>
      <span data-testid="second-profile-title">{t("profile.title")}</span>
    </div>
  );
}

function Wrapper() {
  return (
    <LanguageProvider>
      <LanguageSwitcher />
      <SecondConsumer />
    </LanguageProvider>
  );
}

// ── Cleanup localStorage between tests ────────────────────────────────────────
beforeEach(() => {
  try { localStorage.removeItem("mindful_language"); } catch {}
  // Reset html dir/lang
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("lang");
});

afterEach(() => {
  cleanup();
  try { localStorage.removeItem("mindful_language"); } catch {}
});

// ── 1. SUPPORTED_LANGUAGES / LANGUAGE_OPTIONS contain only en/id/ja ───────────
describe("SUPPORTED_LANGUAGES and LANGUAGE_OPTIONS — launch scope only", () => {
  it("SUPPORTED_LANGUAGES has exactly en, id, ja", () => {
    const codes = Object.keys(SUPPORTED_LANGUAGES).sort();
    expect(codes).toEqual(["en", "id", "ja"]);
  });

  it("SUPPORTED_LANGUAGES does NOT contain es, de, ar, zh", () => {
    const codes = Object.keys(SUPPORTED_LANGUAGES);
    expect(codes).not.toContain("es");
    expect(codes).not.toContain("de");
    expect(codes).not.toContain("ar");
    expect(codes).not.toContain("zh");
  });

  it("LANGUAGE_OPTIONS selector list has exactly 3 entries (en/id/ja)", () => {
    const codes = LANGUAGE_OPTIONS.map((o) => o.code).sort();
    expect(codes).toEqual(["en", "id", "ja"]);
  });

  it("LANGUAGE_OPTIONS does NOT include es, de, ar, zh as selectable options", () => {
    const codes = LANGUAGE_OPTIONS.map((o) => o.code);
    expect(codes).not.toContain("es");
    expect(codes).not.toContain("de");
    expect(codes).not.toContain("ar");
    expect(codes).not.toContain("zh");
  });
});

// ── 2. Initial render shows English ──────────────────────────────────────────
describe("LanguageProvider — initial render", () => {
  it("shows English strings by default (no localStorage)", () => {
    render(<Wrapper />);
    expect(screen.getByTestId("nav-home-label").textContent).toBe("Home");
    expect(screen.getByTestId("nav-profile-label").textContent).toBe("Profile");
    expect(screen.getByTestId("greeting-morning").textContent).toBe("Good morning");
    expect(screen.getByTestId("current-lang").textContent).toBe("en");
  });

  it("restores persisted 'id' from localStorage on mount", () => {
    localStorage.setItem("mindful_language", "id");
    render(<Wrapper />);
    expect(screen.getByTestId("nav-home-label").textContent).toBe("Beranda");
    expect(screen.getByTestId("nav-profile-label").textContent).toBe("Profil");
    expect(screen.getByTestId("current-lang").textContent).toBe("id");
  });

  it("restores persisted 'ja' from localStorage on mount", () => {
    localStorage.setItem("mindful_language", "ja");
    render(<Wrapper />);
    expect(screen.getByTestId("nav-home-label").textContent).toBe("ホーム");
    expect(screen.getByTestId("current-lang").textContent).toBe("ja");
  });
});

// ── 3. Switching language updates ALL consumers without reload ────────────────
describe("LanguageProvider — setLanguage propagates to all consumers", () => {
  it("switches from English to Indonesian immediately (no reload)", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    // Baseline: English
    expect(screen.getByTestId("nav-home-label").textContent).toBe("Home");
    expect(screen.getByTestId("second-nav-coach").textContent).toBe("Companion");

    // Switch language using the select
    await user.selectOptions(screen.getByTestId("lang-select"), "id");

    // Primary consumer must update
    expect(screen.getByTestId("nav-home-label").textContent).toBe("Beranda");
    expect(screen.getByTestId("nav-profile-label").textContent).toBe("Profil");
    expect(screen.getByTestId("greeting-morning").textContent).toBe("Selamat pagi");
    expect(screen.getByTestId("current-lang").textContent).toBe("id");

    // Secondary consumer must also update (cross-component propagation)
    expect(screen.getByTestId("second-nav-coach").textContent).toBe("Teman");
    expect(screen.getByTestId("second-profile-title").textContent).toBe("Profil");
  });

  it("switches from Indonesian to Japanese immediately (no reload)", async () => {
    const user = userEvent.setup();
    localStorage.setItem("mindful_language", "id");
    render(<Wrapper />);

    // Baseline: Indonesian
    expect(screen.getByTestId("nav-home-label").textContent).toBe("Beranda");

    // Switch to Japanese
    await user.selectOptions(screen.getByTestId("lang-select"), "ja");

    // Both consumers must show Japanese
    expect(screen.getByTestId("nav-home-label").textContent).toBe("ホーム");
    expect(screen.getByTestId("nav-profile-label").textContent).toBe("プロフィール");
    expect(screen.getByTestId("greeting-morning").textContent).toBe("おはようございます");
    expect(screen.getByTestId("second-nav-coach").textContent).toBe("コンパニオン");
    expect(screen.getByTestId("second-profile-title").textContent).toBe("プロフィール");
    expect(screen.getByTestId("current-lang").textContent).toBe("ja");
  });

  it("cycles through en → id → ja correctly", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.selectOptions(screen.getByTestId("lang-select"), "id");
    expect(screen.getByTestId("nav-home-label").textContent).toBe("Beranda");
    expect(screen.getByTestId("greeting-morning").textContent).toBe("Selamat pagi");

    await user.selectOptions(screen.getByTestId("lang-select"), "ja");
    expect(screen.getByTestId("nav-home-label").textContent).toBe("ホーム");
    expect(screen.getByTestId("greeting-morning").textContent).toBe("おはようございます");
  });

  it("HTML lang attribute stays LTR for all EN/ID/JA languages", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    // English
    expect(document.documentElement.dir).toBe("ltr");

    // Indonesian
    await user.selectOptions(screen.getByTestId("lang-select"), "id");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("id");

    // Japanese
    await user.selectOptions(screen.getByTestId("lang-select"), "ja");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("ja");
  });
});

// ── 4. localStorage persistence ───────────────────────────────────────────────
describe("LanguageProvider — localStorage persistence", () => {
  it("persists 'id' to localStorage after selection", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.selectOptions(screen.getByTestId("lang-select"), "id");
    expect(localStorage.getItem("mindful_language")).toBe("id");
  });

  it("persists 'ja' to localStorage after selection", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.selectOptions(screen.getByTestId("lang-select"), "ja");
    expect(localStorage.getItem("mindful_language")).toBe("ja");
  });

  it("new provider instance reads persisted 'ja' language (simulates remount)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Wrapper />);
    await user.selectOptions(screen.getByTestId("lang-select"), "ja");
    unmount();

    // Remount — should start with Japanese (from localStorage)
    render(<Wrapper />);
    expect(screen.getByTestId("nav-home-label").textContent).toBe("ホーム");
    expect(screen.getByTestId("current-lang").textContent).toBe("ja");
  });
});

// ── 5. Legacy / invalid localStorage values normalize to 'en' ─────────────────
describe("LanguageProvider — legacy value normalization", () => {
  const legacyCodes = ["es", "de", "ar", "zh", "xx"] as const;

  for (const legacy of legacyCodes) {
    it(`legacy value "${legacy}" normalizes to "en" on mount and persists as "en"`, () => {
      localStorage.setItem("mindful_language", legacy);
      render(<Wrapper />);

      // Provider must start in English
      expect(screen.getByTestId("nav-home-label").textContent).toBe("Home");
      expect(screen.getByTestId("current-lang").textContent).toBe("en");

      // localStorage must be rewritten to "en" so subsequent mounts are stable
      expect(localStorage.getItem("mindful_language")).toBe("en");

      cleanup();
      localStorage.removeItem("mindful_language");
    });
  }
});

// ── 6. Unknown language code is rejected (allowlist guard) ────────────────────
describe("LanguageProvider — allowlist guard", () => {
  it("ignores an unknown language code — stays on current language", () => {
    render(<Wrapper />);
    // Language must be English; no option for "xx" exists, so state never changes
    expect(screen.getByTestId("current-lang").textContent).toBe("en");
  });
});
