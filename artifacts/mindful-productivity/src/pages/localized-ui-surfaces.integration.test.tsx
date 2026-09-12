/**
 * Focused integration tests for REAL localized UI surfaces.
 *
 * Scope:
 *   1. SetupPage (real page) — EN → ID → JA copy changes without reload.
 *      Verifies visible language selector options are exactly en/id/ja.
 *   2. CrisisModal (real modal) — EN/ID/JA system copy changes while
 *      the onClose prop (user-supplied callback) is preserved verbatim.
 *   3. BreathingModal (real modal via BreathingExercise) — EN/ID/JA
 *      system copy changes; onFinish user-supplied prop is preserved verbatim.
 *   4. AuthPage (real page) — EN → ID → JA copy changes without reload.
 *
 * Mocks: useAuth (no real Supabase), supabase module (no network).
 * No production code changes; test files only.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import type { LanguageCode } from "@/lib/translations";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock supabase so no real network calls are made
vi.mock("@/lib/supabase", () => ({
  default: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      updateUser: vi.fn(() => Promise.resolve({ error: null })),
      signInWithOAuth: vi.fn(() => Promise.resolve({ error: null })),
      signInWithPassword: vi.fn(() => Promise.resolve({ error: null })),
      signUp: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

// Mock the supabase default import that auth.tsx uses via relative path
vi.mock("../lib/supabase", () => ({
  default: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      updateUser: vi.fn(() => Promise.resolve({ error: null })),
      signInWithOAuth: vi.fn(() => Promise.resolve({ error: null })),
      signInWithPassword: vi.fn(() => Promise.resolve({ error: null })),
      signUp: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

// Mock useAuth so pages that require auth don't crash
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    session: null,
    loading: false,
    signIn: vi.fn(() => Promise.resolve({ error: null })),
    signUp: vi.fn(() => Promise.resolve({ error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock anxietyChecks (used by BreathingExercise) — no real DB
vi.mock("@/lib/anxietyChecks", () => ({
  createAnxietyCheck: vi.fn(() => Promise.resolve()),
}));

// Mock wouter's useLocation so SetupPage doesn't crash on redirect
vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    ...actual,
    useLocation: vi.fn(() => ["/setup", vi.fn()]),
  };
});

import React from "react";
import { CrisisModal } from "@/components/CrisisModal";
import { BreathingModal } from "@/components/BreathingModal";

// ── Helper: language controller without needing a real <select> ───────────────
function LangSwitchButton({ lang }: { lang: LanguageCode }) {
  const { setLanguage } = useLanguage();
  return (
    <button data-testid={`switch-to-${lang}`} onClick={() => setLanguage(lang)}>
      switch to {lang}
    </button>
  );
}

// ── Cleanup between tests ─────────────────────────────────────────────────────
beforeEach(() => {
  try { localStorage.removeItem("mindful_language"); } catch {}
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("lang");
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  try { localStorage.removeItem("mindful_language"); } catch {}
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. SetupPage — real page, language selector options, EN → ID → JA copy
// ─────────────────────────────────────────────────────────────────────────────
describe("SetupPage — real page localization", () => {
  async function renderSetupInLang(lang: LanguageCode) {
    if (lang !== "en") localStorage.setItem("mindful_language", lang);
    const SetupPage = (await import("./setup")).default;
    render(
      <LanguageProvider>
        <Router>
          <SetupPage />
        </Router>
      </LanguageProvider>,
    );
  }

  it("step 0 title is English by default", async () => {
    await renderSetupInLang("en");
    // The heading for step 0 is setup.step0.title
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Choose your language",
    );
  });

  it("step 0 title is Indonesian when language is id", async () => {
    await renderSetupInLang("id");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Pilih bahasamu",
    );
  });

  it("step 0 title is Japanese when language is ja", async () => {
    await renderSetupInLang("ja");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "言語を選択",
    );
  });

  it("visible language selector options contain only en, id, ja", async () => {
    await renderSetupInLang("en");
    // The SetupPage renders language buttons with data-testid="lang-{code}"
    const enBtn = screen.getByTestId("lang-en");
    const idBtn = screen.getByTestId("lang-id");
    const jaBtn = screen.getByTestId("lang-ja");
    expect(enBtn).toBeTruthy();
    expect(idBtn).toBeTruthy();
    expect(jaBtn).toBeTruthy();
    // Retired languages must NOT be present as buttons
    expect(screen.queryByTestId("lang-es")).toBeNull();
    expect(screen.queryByTestId("lang-de")).toBeNull();
    expect(screen.queryByTestId("lang-ar")).toBeNull();
    expect(screen.queryByTestId("lang-zh")).toBeNull();
  });

  it("clicking a language button changes the step0 subtitle copy without reload (EN → ID → JA)", async () => {
    const user = userEvent.setup();
    await renderSetupInLang("en");

    // English subtitle baseline
    expect(
      screen.getByText("Your coach and daily content will speak your language"),
    ).toBeTruthy();

    // Click Indonesian button
    await user.click(screen.getByTestId("lang-id"));
    expect(
      screen.getByText(
        "Pelatih dan konten harianmu akan berbicara dalam bahasamu",
      ),
    ).toBeTruthy();

    // Click Japanese button
    await user.click(screen.getByTestId("lang-ja"));
    expect(
      screen.getByText("コーチと日々のコンテンツがあなたの言語で届きます"),
    ).toBeTruthy();
  });

  it("Next button label translates: EN=Next →, ID=Berikutnya →, JA=次へ →", async () => {
    const user = userEvent.setup();
    await renderSetupInLang("en");

    // EN default
    expect(screen.getByTestId("button-next").textContent).toBe("Next →");

    // Switch to ID
    await user.click(screen.getByTestId("lang-id"));
    expect(screen.getByTestId("button-next").textContent).toBe(
      "Berikutnya →",
    );

    // Switch to JA
    await user.click(screen.getByTestId("lang-ja"));
    expect(screen.getByTestId("button-next").textContent).toBe("次へ →");
  });

  it("step indicator text changes with language (EN → ID → JA)", async () => {
    const user = userEvent.setup();
    await renderSetupInLang("en");

    // EN: "Step 1 of 5"
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();

    await user.click(screen.getByTestId("lang-id"));
    expect(screen.getByText("Langkah 1 dari 5")).toBeTruthy();

    await user.click(screen.getByTestId("lang-ja"));
    expect(screen.getByText("ステップ 1 / 5")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CrisisModal — real modal, EN/ID/JA system copy, prop preserved verbatim
// ─────────────────────────────────────────────────────────────────────────────
describe("CrisisModal — real modal localization", () => {
  function renderCrisisModal(lang: LanguageCode, onClose: () => void) {
    if (lang !== "en") localStorage.setItem("mindful_language", lang);
    return render(
      <LanguageProvider>
        <CrisisModal onClose={onClose} />
      </LanguageProvider>,
    );
  }

  it("renders English system copy by default", () => {
    const onClose = vi.fn();
    renderCrisisModal("en", onClose);

    expect(screen.getByTestId("crisis-modal")).toBeTruthy();
    expect(screen.getByText("We care about you")).toBeTruthy();
    expect(
      screen.getByText(
        "It sounds like you might be going through a really difficult time. You deserve support from someone who can truly help.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("button-crisis-call").textContent?.trim()).toBe(
      "Call now",
    );
    expect(
      screen.getByTestId("button-crisis-continue").textContent?.trim(),
    ).toBe("I'm okay, continue chatting");
  });

  it("renders Indonesian system copy when language is id", () => {
    const onClose = vi.fn();
    renderCrisisModal("id", onClose);

    expect(screen.getByText("Kami peduli padamu")).toBeTruthy();
    expect(
      screen.getByText(
        "Kedengarannya kamu mungkin sedang melalui masa yang sangat sulit. Kamu berhak mendapat dukungan dari seseorang yang benar-benar bisa membantu.",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("button-crisis-call").textContent?.trim()).toBe(
      "Hubungi sekarang",
    );
    expect(
      screen.getByTestId("button-crisis-continue").textContent?.trim(),
    ).toBe("Saya baik-baik saja, lanjutkan obrolan");
  });

  it("renders Japanese system copy when language is ja", () => {
    const onClose = vi.fn();
    renderCrisisModal("ja", onClose);

    expect(
      screen.getByText("あなたのことを気にかけています"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "本当に辛い時期を過ごしているかもしれません。本当に助けられる人からのサポートを受ける価値があります。",
      ),
    ).toBeTruthy();
    expect(screen.getByTestId("button-crisis-call").textContent?.trim()).toBe(
      "今すぐ電話する",
    );
    expect(
      screen.getByTestId("button-crisis-continue").textContent?.trim(),
    ).toBe("大丈夫です、チャットを続ける");
  });

  it("switches system copy EN → ID → JA without remount (in-place language switch)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    // Render with a language switcher alongside the modal
    render(
      <LanguageProvider>
        <LangSwitchButton lang="id" />
        <LangSwitchButton lang="ja" />
        <CrisisModal onClose={onClose} />
      </LanguageProvider>,
    );

    // Baseline: English
    expect(screen.getByText("We care about you")).toBeTruthy();

    // Switch to Indonesian
    await user.click(screen.getByTestId("switch-to-id"));
    expect(screen.getByText("Kami peduli padamu")).toBeTruthy();
    expect(
      screen.getByTestId("button-crisis-continue").textContent?.trim(),
    ).toBe("Saya baik-baik saja, lanjutkan obrolan");

    // Switch to Japanese
    await user.click(screen.getByTestId("switch-to-ja"));
    expect(
      screen.getByText("あなたのことを気にかけています"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("button-crisis-continue").textContent?.trim(),
    ).toBe("大丈夫です、チャットを続ける");
  });

  it("user-supplied onClose prop is preserved verbatim: fires when continue is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderCrisisModal("en", onClose);

    await user.click(screen.getByTestId("button-crisis-continue"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("user-supplied onClose prop fires correctly in Indonesian mode too", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderCrisisModal("id", onClose);

    await user.click(screen.getByTestId("button-crisis-continue"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("user-supplied onClose prop fires correctly in Japanese mode too", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderCrisisModal("ja", onClose);

    await user.click(screen.getByTestId("button-crisis-continue"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("copy changes do NOT change how many times onClose fires (still exactly once per click)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <LanguageProvider>
        <LangSwitchButton lang="id" />
        <LangSwitchButton lang="ja" />
        <CrisisModal onClose={onClose} />
      </LanguageProvider>,
    );

    // Switch language twice before clicking continue
    await user.click(screen.getByTestId("switch-to-id"));
    await user.click(screen.getByTestId("switch-to-ja"));

    await user.click(screen.getByTestId("button-crisis-continue"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. BreathingModal — real modal (via BreathingExercise), EN/ID/JA copy,
//    onFinish user-supplied prop is preserved verbatim
// ─────────────────────────────────────────────────────────────────────────────
describe("BreathingModal — real modal localization", () => {
  // BreathingExercise uses timers; fake them so tests don't time out.
  // We only test the initial render (phase 0 = inhale) and prop preservation.

  function renderBreathingModal(lang: LanguageCode, onFinish: (completed: boolean) => void) {
    if (lang !== "en") localStorage.setItem("mindful_language", lang);
    return render(
      <LanguageProvider>
        <BreathingModal onClose={() => onFinish(false)} />
      </LanguageProvider>,
    );
  }

  it("renders English phase label on initial mount (breathing.phase.inhale)", () => {
    const onFinish = vi.fn();
    renderBreathingModal("en", onFinish);
    // The first phase is "inhale" — translated as "Breathe in..."
    expect(screen.getByText("Breathe in...")).toBeTruthy();
  });

  it("renders Indonesian phase label on initial mount", () => {
    const onFinish = vi.fn();
    renderBreathingModal("id", onFinish);
    expect(screen.getByText("Tarik napas...")).toBeTruthy();
  });

  it("renders Japanese phase label on initial mount", () => {
    const onFinish = vi.fn();
    renderBreathingModal("ja", onFinish);
    expect(screen.getByText("吸って...")).toBeTruthy();
  });

  it("'end early' button label changes with language EN/ID/JA", () => {
    // EN
    renderBreathingModal("en", vi.fn());
    expect(screen.getByTestId("button-breathing-end-early").textContent).toBe(
      "End early",
    );
    cleanup();
    localStorage.removeItem("mindful_language");

    // ID
    renderBreathingModal("id", vi.fn());
    expect(screen.getByTestId("button-breathing-end-early").textContent).toBe(
      "Akhiri lebih awal",
    );
    cleanup();
    localStorage.removeItem("mindful_language");

    // JA
    renderBreathingModal("ja", vi.fn());
    expect(screen.getByTestId("button-breathing-end-early").textContent).toBe(
      "早めに終了",
    );
  });

  it("switches phase-label copy EN → ID → JA without remount", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();

    render(
      <LanguageProvider>
        <LangSwitchButton lang="id" />
        <LangSwitchButton lang="ja" />
        <BreathingModal onClose={() => onFinish(false)} />
      </LanguageProvider>,
    );

    // EN baseline
    expect(screen.getByText("Breathe in...")).toBeTruthy();

    // Switch to Indonesian
    await user.click(screen.getByTestId("switch-to-id"));
    expect(screen.getByText("Tarik napas...")).toBeTruthy();

    // Switch to Japanese
    await user.click(screen.getByTestId("switch-to-ja"));
    expect(screen.getByText("吸って...")).toBeTruthy();
  });

  it("user-supplied onClose prop fires when end-early is clicked (EN)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderBreathingModal("en", onClose);

    await user.click(screen.getByTestId("button-breathing-end-early"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("user-supplied onClose prop fires when end-early is clicked (ID)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderBreathingModal("id", onClose);

    await user.click(screen.getByTestId("button-breathing-end-early"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("user-supplied onClose prop fires when end-early is clicked (JA)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderBreathingModal("ja", onClose);

    await user.click(screen.getByTestId("button-breathing-end-early"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. AuthPage — real page, EN → ID → JA copy changes without reload
// ─────────────────────────────────────────────────────────────────────────────
describe("AuthPage — real page localization", () => {
  async function renderAuthInLang(lang: LanguageCode) {
    if (lang !== "en") localStorage.setItem("mindful_language", lang);
    const AuthPage = (await import("./auth")).default;
    return render(
      <LanguageProvider>
        <Router>
          <LangSwitchButton lang="id" />
          <LangSwitchButton lang="ja" />
          <LangSwitchButton lang="en" />
          <AuthPage />
        </Router>
      </LanguageProvider>,
    );
  }

  it("renders English tagline and tab labels by default", async () => {
    await renderAuthInLang("en");
    expect(screen.getByText("Your mindful companion.")).toBeTruthy();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
    expect(screen.getByTestId("tab-signin").textContent).toBe("Sign In");
    expect(screen.getByTestId("tab-signup").textContent).toBe("Sign Up");
  });

  it("renders Indonesian copy when language is id", async () => {
    await renderAuthInLang("id");
    expect(screen.getByText("Teman mindful-mu.")).toBeTruthy();
    expect(screen.getByText("Lanjutkan dengan Google")).toBeTruthy();
    expect(screen.getByTestId("tab-signin").textContent).toBe("Masuk");
    expect(screen.getByTestId("tab-signup").textContent).toBe("Daftar");
  });

  it("renders Japanese copy when language is ja", async () => {
    await renderAuthInLang("ja");
    expect(screen.getByText("あなたのマインドフルな伴走者。")).toBeTruthy();
    expect(screen.getByText("Googleで続ける")).toBeTruthy();
    expect(screen.getByTestId("tab-signin").textContent).toBe("サインイン");
    expect(screen.getByTestId("tab-signup").textContent).toBe("新規登録");
  });

  it("switches copy EN → ID → JA without reload", async () => {
    const user = userEvent.setup();
    await renderAuthInLang("en");

    // EN baseline
    expect(screen.getByText("Your mindful companion.")).toBeTruthy();

    // Switch to Indonesian
    await user.click(screen.getByTestId("switch-to-id"));
    expect(screen.getByText("Teman mindful-mu.")).toBeTruthy();
    expect(screen.getByTestId("tab-signin").textContent).toBe("Masuk");

    // Switch to Japanese
    await user.click(screen.getByTestId("switch-to-ja"));
    expect(screen.getByText("あなたのマインドフルな伴走者。")).toBeTruthy();
    expect(screen.getByTestId("tab-signin").textContent).toBe("サインイン");
  });

  it("divider text changes with language (EN → ID → JA)", async () => {
    const user = userEvent.setup();
    await renderAuthInLang("en");

    expect(screen.getByText("or continue with email")).toBeTruthy();

    await user.click(screen.getByTestId("switch-to-id"));
    expect(screen.getByText("atau lanjutkan dengan email")).toBeTruthy();

    await user.click(screen.getByTestId("switch-to-ja"));
    expect(screen.getByText("またはメールで続ける")).toBeTruthy();
  });
});
