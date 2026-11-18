import { afterEach, describe, expect, it } from "vitest";
import {
  FOCUS_GOAL_IDS,
  completeFocusGoalOnboarding,
  loadFocusGoals,
  loadFocusGoalsRecord,
  onboardingCompleted,
  sanitizeFocusGoals,
  saveFocusGoals,
  shouldShowFocusGoalOnboarding,
} from "./focusGoals";

describe("focus goal preferences", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("keeps only known goal ids", () => {
    expect(sanitizeFocusGoals(["mood", "anxiety", "journal", "mood", 3])).toEqual([
      "mood",
      "journal",
    ]);
  });

  it("shows the first-run screen for a new user", () => {
    expect(shouldShowFocusGoalOnboarding("user-1")).toBe(true);
    expect(onboardingCompleted("user-1")).toBe(false);
  });

  it("hides the screen after the user chooses goals", () => {
    completeFocusGoalOnboarding("user-1", ["calm", "sleep"], false);
    expect(shouldShowFocusGoalOnboarding("user-1")).toBe(false);
    expect(onboardingCompleted("user-1")).toBe(true);
    expect(loadFocusGoals("user-1")).toEqual(["calm", "sleep"]);
    expect(loadFocusGoalsRecord("user-1")?.skipped).toBe(false);
  });

  it("lets skippers use the app without storing a health conclusion", () => {
    completeFocusGoalOnboarding("user-1", ["mood"], true);
    expect(shouldShowFocusGoalOnboarding("user-1")).toBe(false);
    expect(onboardingCompleted("user-1")).toBe(true);
    expect(loadFocusGoals("user-1")).toEqual([]);
    expect(loadFocusGoalsRecord("user-1")?.skipped).toBe(true);
  });

  it("does not re-prompt users who already finished the older intro", () => {
    localStorage.setItem("onboarding_completed_user-1", "1");
    expect(shouldShowFocusGoalOnboarding("user-1")).toBe(false);
    expect(loadFocusGoals("user-1")).toEqual([]);
  });

  it("keeps another account on the first-run path", () => {
    completeFocusGoalOnboarding("user-1", ["focus"], false);
    expect(shouldShowFocusGoalOnboarding("user-2")).toBe(true);
  });

  it("can update saved goals later from profile", () => {
    completeFocusGoalOnboarding("user-1", ["journal"], false);
    saveFocusGoals("user-1", ["journal", "mood"]);
    expect(loadFocusGoals("user-1")).toEqual(["journal", "mood"]);
    expect(shouldShowFocusGoalOnboarding("user-1")).toBe(false);
  });

  it("covers every offered goal id", () => {
    expect([...FOCUS_GOAL_IDS]).toEqual(["mood", "calm", "focus", "sleep", "journal"]);
  });
});
