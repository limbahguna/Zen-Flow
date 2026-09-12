/**
 * Integration test: real BottomNav component inside LanguageProvider.
 *
 * Scope: EN / ID / JA launch languages only.
 * Arabic / RTL assertions have been removed — all launch languages are LTR.
 *
 * Verifies that the REAL BottomNav (not a mock consumer) immediately shows
 * translated labels when setLanguage() is called — proving end-to-end
 * propagation from context to the actual nav component users see.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { Router } from "wouter";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { BottomNav } from "./BottomNav";
import type { LanguageCode } from "@/lib/translations";

// ── Helper: a controller component that exposes setLanguage to tests
// without needing userEvent on a select element.
function LanguageController({ targetLang }: { targetLang: LanguageCode }) {
  const { setLanguage } = useLanguage();
  return (
    <button
      data-testid="switch-lang"
      onClick={() => setLanguage(targetLang)}
    >
      Switch
    </button>
  );
}

function TestApp({ targetLang }: { targetLang: LanguageCode }) {
  return (
    <LanguageProvider>
      {/* wouter Router is required because BottomNav uses useLocation */}
      <Router>
        <LanguageController targetLang={targetLang} />
        <BottomNav />
      </Router>
    </LanguageProvider>
  );
}

beforeEach(() => {
  try { localStorage.removeItem("mindful_language"); } catch {}
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("lang");
});

afterEach(() => {
  cleanup();
  try { localStorage.removeItem("mindful_language"); } catch {}
});

describe("BottomNav — real component with LanguageProvider", () => {
  it("keeps all four navigation targets inside the safe-area-aware nav", () => {
    render(<TestApp targetLang="en" />);

    const nav = screen.getByTestId("bottom-nav");
    expect(nav.className).toContain("bottom-nav");
    expect(nav.className).toContain("fixed");
    expect(nav.className).toContain("bottom-0");

    for (const target of ["home", "practice", "coach", "profile"]) {
      const button = screen.getByTestId(`nav-${target}`);
      expect(nav.contains(button)).toBe(true);
      expect(button.className).toContain("h-full");
      expect(button.className).toContain("flex-1");
    }
  });

  // ── English (default) ──────────────────────────────────────────────────────
  it("renders English labels by default", () => {
    render(<TestApp targetLang="ja" />);

    expect(screen.getByTestId("nav-home").getAttribute("aria-label")).toBe("Home");
    expect(screen.getByTestId("nav-practice").getAttribute("aria-label")).toBe("Practice");
    expect(screen.getByTestId("nav-coach").getAttribute("aria-label")).toBe("Companion");
    expect(screen.getByTestId("nav-profile").getAttribute("aria-label")).toBe("Profile");
  });

  it("document direction is ltr for English (default)", () => {
    render(<TestApp targetLang="en" />);
    expect(document.documentElement.dir).toBe("ltr");
  });

  // ── Japanese ──────────────────────────────────────────────────────────────
  it("switches BottomNav labels to Japanese immediately when setLanguage('ja') is called", async () => {
    render(<TestApp targetLang="ja" />);

    // Confirm English baseline
    expect(screen.getByTestId("nav-home").getAttribute("aria-label")).toBe("Home");

    // Trigger language switch
    await act(async () => {
      screen.getByTestId("switch-lang").click();
    });

    // Real BottomNav must now show Japanese labels
    expect(screen.getByTestId("nav-home").getAttribute("aria-label")).toBe("ホーム");
    expect(screen.getByTestId("nav-practice").getAttribute("aria-label")).toBe("練習");
    expect(screen.getByTestId("nav-coach").getAttribute("aria-label")).toBe("コンパニオン");
    expect(screen.getByTestId("nav-profile").getAttribute("aria-label")).toBe("プロフィール");
  });

  it("document direction remains ltr after switching to Japanese", async () => {
    render(<TestApp targetLang="ja" />);

    await act(async () => {
      screen.getByTestId("switch-lang").click();
    });

    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("ja");
  });

  // ── Indonesian ────────────────────────────────────────────────────────────
  it("switches BottomNav labels to Indonesian immediately when setLanguage('id') is called", async () => {
    render(<TestApp targetLang="id" />);

    await act(async () => {
      screen.getByTestId("switch-lang").click();
    });

    expect(screen.getByTestId("nav-home").getAttribute("aria-label")).toBe("Beranda");
    expect(screen.getByTestId("nav-practice").getAttribute("aria-label")).toBe("Latihan");
    expect(screen.getByTestId("nav-coach").getAttribute("aria-label")).toBe("Teman");
    expect(screen.getByTestId("nav-profile").getAttribute("aria-label")).toBe("Profil");
  });

  it("document direction remains ltr after switching to Indonesian", async () => {
    render(<TestApp targetLang="id" />);

    await act(async () => {
      screen.getByTestId("switch-lang").click();
    });

    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("id");
  });

  // ── Cycle EN → ID → JA ────────────────────────────────────────────────────
  it("cycles correctly: starts English, switches to id, then can switch to ja from a fresh mount", async () => {
    // First mount: switch to id
    const { unmount } = render(<TestApp targetLang="id" />);
    await act(async () => { screen.getByTestId("switch-lang").click(); });
    expect(screen.getByTestId("nav-home").getAttribute("aria-label")).toBe("Beranda");
    unmount();

    // Second mount: switch to ja
    render(<TestApp targetLang="ja" />);
    // localStorage still has "id" from prior switch, so baseline is Indonesian
    expect(screen.getByTestId("nav-home").getAttribute("aria-label")).toBe("Beranda");
    await act(async () => { screen.getByTestId("switch-lang").click(); });
    expect(screen.getByTestId("nav-home").getAttribute("aria-label")).toBe("ホーム");
  });
});
