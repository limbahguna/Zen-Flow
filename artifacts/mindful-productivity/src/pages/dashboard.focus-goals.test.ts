import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSrc(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");
}

describe("dashboard first-run focus goals", () => {
  it("still opens existing login and setup routes unchanged", () => {
    const app = readSrc("App.tsx");
    expect(app).toContain('path="/auth"');
    expect(app).toContain('path="/setup"');
    expect(app).toContain("<ProtectedRoute>");
    expect(app).not.toContain("FocusGoal");
  });

  it("shows the overlay after the disclaimer without replacing login", () => {
    const dashboard = readSrc("pages/dashboard.tsx");
    expect(dashboard).toContain("OnboardingFlow");
    expect(dashboard).toContain("onboardingCompleted");
    expect(dashboard).toContain("mindful_disclaimer_dismissed_");
    expect(dashboard).not.toContain("updateUser");
  });

  it("keeps skip from blocking navigation chrome", () => {
    const flow = readSrc("components/OnboardingFlow.tsx");
    expect(flow).toContain("button-onboarding-skip");
    expect(flow).toContain("completeFocusGoalOnboarding");
    expect(flow).not.toContain("supabase");
    expect(flow).not.toContain("initial_mood");
  });
});
