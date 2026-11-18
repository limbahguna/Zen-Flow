import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/context/LanguageContext";
import { loadFocusGoals } from "@/lib/focusGoals";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "ada@example.com", created_at: "2026-01-01T00:00:00Z" },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({
    displayName: "Ada",
    updateProfile: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTasks", () => ({
  useTasks: () => ({ data: [] }),
}));

vi.mock("@/hooks/useJournal", () => ({
  useJournal: () => ({ data: [] }),
}));

vi.mock("@/hooks/useAnxietyChecks", () => ({
  useAnxietyChecks: () => ({ data: [] }),
}));

vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    ...actual,
    useLocation: () => ["/profile", vi.fn()],
  };
});

import ProfilePage from "./profile";

describe("profile practice focus", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mindful_language", "en");
    localStorage.setItem(
      "mindful_focus_goals_user-1",
      JSON.stringify({ version: 1, goals: ["sleep"], skipped: false }),
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("lets returning users change saved goals", async () => {
    render(
      <LanguageProvider>
        <ProfilePage />
      </LanguageProvider>,
    );

    expect(screen.getByTestId("profile-focus-goals")).toBeTruthy();
    expect(screen.getByTestId("focus-goal-sleep").getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(screen.getByTestId("focus-goal-focus"));
    expect(loadFocusGoals("user-1")).toEqual(["sleep", "focus"]);
    expect(screen.getByTestId("focus-goal-focus").getAttribute("aria-pressed")).toBe("true");
  });
});
