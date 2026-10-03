import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/context/LanguageContext";

const subscription = vi.hoisted(() => ({
  remainingThisMonth: 7,
  monthlyLimit: 10,
  remainingToday: 5,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "coach-user" },
    session: { access_token: "test-access-token" },
    loading: false,
  })),
}));
vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn(() => ({ data: [] })) }));
vi.mock("@/hooks/useAnxietyChecks", () => ({ useAnxietyChecks: vi.fn(() => ({ data: [] })) }));
vi.mock("@/hooks/useJournal", () => ({ useJournal: vi.fn(() => ({ data: [] })) }));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(() => ({ data: subscription })),
}));
vi.mock("@/context/CoachContext", () => ({
  useCoachContext: vi.fn(() => ({ messages: [], setMessages: vi.fn() })),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));
vi.mock("@/lib/apiRuntime", () => ({ appApiUrl: (path: string) => path }));
vi.mock("@/components/CrisisModal", () => ({ CrisisModal: () => null }));

function renderCoach() {
  localStorage.setItem("mindful_language", "en");
  return render(
    <LanguageProvider>
      <CoachPage />
    </LanguageProvider>,
  );
}

let CoachPage: (typeof import("./coach"))["default"];

beforeEach(async () => {
  cleanup();
  localStorage.clear();
  subscription.remainingThisMonth = 7;
  subscription.monthlyLimit = 10;
  Element.prototype.scrollIntoView = vi.fn();
  CoachPage = (await import("./coach")).default;
});

describe("coach monthly allowance", () => {
  it("shows how many messages remain this month", async () => {
    renderCoach();
    await waitFor(() => {
      expect(screen.getByTestId("coach-remaining").textContent).toContain("7 of 10");
    });
  });

  it("explains the monthly limit and keeps basic navigation available", async () => {
    subscription.remainingThisMonth = 0;
    renderCoach();
    await waitFor(() => {
      expect(screen.getByTestId("coach-monthly-limit").textContent).toContain(
        "Journal, mood check-in, intentions, and lessons are still here.",
      );
    });
    expect(screen.getByTestId("nav-home")).toBeTruthy();
    expect(screen.getByTestId("nav-practice")).toBeTruthy();
    expect(screen.getByTestId("nav-profile")).toBeTruthy();
    expect((screen.getByTestId("coach-input") as HTMLTextAreaElement).disabled).toBe(true);
  });
});
