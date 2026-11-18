import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/context/LanguageContext";
import { OnboardingFlow } from "./OnboardingFlow";
import { loadFocusGoals, loadFocusGoalsRecord, onboardingCompleted } from "@/lib/focusGoals";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

function renderFlow(onComplete = vi.fn()) {
  return {
    onComplete,
    ...render(
      <LanguageProvider>
        <OnboardingFlow onComplete={onComplete} />
      </LanguageProvider>,
    ),
  };
}

describe("focus goal onboarding", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mindful_language", "id");
    mocks.user = { id: "user-1" };
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("asks what the user wants to focus on and maps cards to existing tools", () => {
    renderFlow();
    expect(screen.getByTestId("onboarding-flow").textContent).toContain(
      "Apa yang ingin kamu fokuskan?",
    );
    expect(screen.getByTestId("focus-goal-mood").textContent).toContain("Memahami pola suasana hati");
    expect(screen.getByTestId("focus-goal-mood").textContent).toContain("Beranda");
    expect(screen.getByTestId("focus-goal-calm").textContent).toContain("lebih tenang");
    expect(screen.getByTestId("focus-goal-focus").textContent).toContain("fokus dan rutinitas");
    expect(screen.getByTestId("focus-goal-sleep").textContent).toContain("tidur");
    expect(screen.getByTestId("focus-goal-journal").textContent).toContain("jurnal");
    expect(screen.getByTestId("button-onboarding-continue")).toHaveProperty("disabled", true);
  });

  it("lets a new user select several goals and continue", async () => {
    const { onComplete } = renderFlow();
    await userEvent.click(screen.getByTestId("focus-goal-mood"));
    await userEvent.click(screen.getByTestId("focus-goal-journal"));
    expect(screen.getByTestId("button-onboarding-continue")).toHaveProperty("disabled", false);
    await userEvent.click(screen.getByTestId("button-onboarding-continue"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(loadFocusGoals("user-1")).toEqual(["mood", "journal"]);
    expect(onboardingCompleted("user-1")).toBe(true);
  });

  it("does not block skippers from using the app", async () => {
    const { onComplete } = renderFlow();
    await userEvent.click(screen.getByTestId("button-onboarding-skip"));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(loadFocusGoals("user-1")).toEqual([]);
    expect(loadFocusGoalsRecord("user-1")?.skipped).toBe(true);
    expect(onboardingCompleted("user-1")).toBe(true);
  });

  it("does not use diagnosis or therapy claims", () => {
    localStorage.setItem("mindful_language", "en");
    renderFlow();
    const text = screen.getByTestId("onboarding-flow").textContent ?? "";
    expect(text.toLowerCase()).not.toMatch(/heal|cure|treat|disorder|psychiatr/);
    expect(text).toContain("not diagnosis or therapy");
  });
});
