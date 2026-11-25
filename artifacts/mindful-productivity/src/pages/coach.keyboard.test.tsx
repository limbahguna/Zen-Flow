import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";
import { LanguageProvider } from "@/context/LanguageContext";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "coach-user" },
    session: { access_token: "test-access-token" },
    loading: false,
  })),
}));
vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn(() => ({ data: [] })) }));
vi.mock("@/hooks/useAnxietyChecks", () => ({
  useAnxietyChecks: vi.fn(() => ({ data: [] })),
}));
vi.mock("@/hooks/useJournal", () => ({ useJournal: vi.fn(() => ({ data: [] })) }));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(() => ({ data: { remainingToday: 5, monthlyLimit: 10 } })),
}));
vi.mock("@/context/CoachContext", () => ({
  useCoachContext: vi.fn(() => ({
    messages: [{ id: "user-message", role: "user" as const, content: "Hello" }],
    setMessages: vi.fn(),
  })),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));
vi.mock("@/lib/apiRuntime", () => ({
  appApiUrl: (path: string) => path,
}));
vi.mock("@/components/CrisisModal", () => ({ CrisisModal: () => null }));

type ViewportStub = {
  height: number;
  offsetTop: number;
  emit: (type: string) => void;
};

function installViewport(): ViewportStub {
  const handlers = new Map<string, Set<EventListener>>();
  const viewport = {
    height: 800,
    offsetTop: 0,
    addEventListener(type: string, callback: EventListener) {
      const set = handlers.get(type) ?? new Set<EventListener>();
      set.add(callback);
      handlers.set(type, set);
    },
    removeEventListener(type: string, callback: EventListener) {
      handlers.get(type)?.delete(callback);
    },
    emit(type: string) {
      handlers.get(type)?.forEach((callback) => callback(new Event(type)));
    },
  };
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  return viewport;
}

let CoachPage: (typeof import("./coach"))["default"];

beforeEach(async () => {
  localStorage.setItem("mindful_language", "en");
  Element.prototype.scrollIntoView = vi.fn();
  CoachPage = (await import("./coach")).default;
});

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--keyboard-inset");
  document.documentElement.classList.remove("keyboard-open");
  document.documentElement.removeAttribute("dir");
  Reflect.deleteProperty(window, "visualViewport");
  localStorage.removeItem("mindful_language");
});

function renderCoach() {
  return render(
    <LanguageProvider>
      <Router>
        <CoachPage />
      </Router>
    </LanguageProvider>,
  );
}

describe("Coach keyboard inset", () => {
  it("keeps the composer above the nav while the keyboard is closed", async () => {
    installViewport();
    renderCoach();

    await waitFor(() => {
      expect(screen.getByTestId("bottom-nav")).toBeTruthy();
    });
    const composer = screen.getByTestId("coach-composer");
    expect(composer.style.bottom).toBe("calc(4rem + env(safe-area-inset-bottom, 0px))");
    expect(composer.querySelector("form")?.className).not.toContain("flex-row-reverse");
    expect(screen.getByTestId("coach-input").className).toContain("text-[16px]");
  });

  it("hides BottomNav and moves the composer when the keyboard is open", async () => {
    const viewport = installViewport();
    document.documentElement.dir = "rtl";
    renderCoach();

    viewport.height = 500;
    viewport.offsetTop = 0;
    viewport.emit("resize");

    await waitFor(() => {
      expect(screen.queryByTestId("bottom-nav")).toBeNull();
    });
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(true);
    expect(screen.getByTestId("coach-composer").style.bottom).toBe("var(--keyboard-inset)");
    expect(document.documentElement.style.getPropertyValue("--keyboard-inset")).toBe("300px");
    const main = screen.getByTestId("coach-input").closest("main") ?? document.querySelector("main");
    expect(main?.getAttribute("style")).toContain("var(--keyboard-inset)");
  });
});
