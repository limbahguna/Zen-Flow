import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/context/LanguageContext";
import type { DailyActivity, DailyPlanSnapshot, ProgramEnrollment, WellnessPreferences } from "@/lib/wellness/types";
import { getProgram } from "@/lib/wellness/programCatalog";
import { DashboardProgressCard } from "@/components/progress/DashboardProgressCard";

const toast = vi.fn();
const setLocation = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));
vi.mock("@/components/BottomNav", () => ({ BottomNav: () => <nav /> }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return { ...actual, useLocation: () => ["/progress", setLocation] };
});

const getActiveEnrollment = vi.fn();
const listRecentEnrollments = vi.fn();
vi.mock("@/lib/wellness/programEnrollments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wellness/programEnrollments")>();
  return {
    ...actual,
    getActiveEnrollment: (...args: unknown[]) => getActiveEnrollment(...args),
    listRecentEnrollments: (...args: unknown[]) => listRecentEnrollments(...args),
  };
});

const getWellnessPreferences = vi.fn();
vi.mock("@/lib/wellness/wellnessPreferences", () => ({
  getWellnessPreferences: (...args: unknown[]) => getWellnessPreferences(...args),
  saveWellnessPreferences: vi.fn(),
}));

const loadOrCreateDailyPlan = vi.fn();
const listDailyPlansInRange = vi.fn();
const completeWellnessDailyPlan = vi.fn();
vi.mock("@/lib/wellness/dailyPlans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wellness/dailyPlans")>();
  return {
    ...actual,
    loadOrCreateDailyPlan: (...args: unknown[]) => loadOrCreateDailyPlan(...args),
    listDailyPlansInRange: (...args: unknown[]) => listDailyPlansInRange(...args),
    completeWellnessDailyPlan: (...args: unknown[]) => completeWellnessDailyPlan(...args),
  };
});

const listDailyActivityInRange = vi.fn();
const completeDailyPlanItem = vi.fn();
vi.mock("@/lib/wellness/dailyActivity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wellness/dailyActivity")>();
  return {
    ...actual,
    listDailyActivityInRange: (...args: unknown[]) => listDailyActivityInRange(...args),
    completeDailyPlanItem: (...args: unknown[]) => completeDailyPlanItem(...args),
  };
});

import { useAuth } from "@/hooks/useAuth";
import ProgressPage from "./progress";

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const PREFS: WellnessPreferences = {
  user_id: "user-1",
  primary_goal: "stress",
  preferred_duration_minutes: 5,
  preferred_reminder_time: "09:00:00",
  timezone: "Asia/Jakarta",
  locale: "en",
  created_at: "2026-09-20T00:00:00Z",
  updated_at: "2026-09-20T00:00:00Z",
};

const ENROLLMENT: ProgramEnrollment = {
  id: "enroll-1",
  user_id: "user-1",
  program_slug: "calm-reset",
  status: "active",
  current_day: 2,
  started_on: "2026-09-19",
  completed_on: null,
  created_at: "2026-09-19T00:00:00Z",
  updated_at: "2026-09-20T00:00:00Z",
};

function snapshot(overrides: Partial<DailyPlanSnapshot> = {}): DailyPlanSnapshot {
  return {
    id: "plan-1",
    user_id: "user-1",
    local_date: "2026-09-20",
    enrollment_id: "enroll-1",
    program_slug: "calm-reset",
    program_day: 1,
    primary_goal: "stress",
    plan_version: 1,
    lesson_id: "local-1",
    items: [
      { item_key: "mood_checkin", item_type: "mood_checkin", required: true, planned_minutes: 1 },
      { item_key: "daily_insight", item_type: "daily_insight", required: true, planned_minutes: 2 },
      { item_key: "program_practice", item_type: "program_practice", required: true, planned_minutes: 5, practice_kind: "breathing" },
      { item_key: "reflection", item_type: "reflection", required: false, planned_minutes: 1 },
    ],
    completed_at: "2026-09-20T02:00:00Z",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    ...overrides,
  };
}

function activity(key: DailyActivity["item_key"], extra: Partial<DailyActivity> = {}): DailyActivity {
  return {
    id: `act-${key}`,
    user_id: "user-1",
    daily_plan_id: "plan-1",
    local_date: "2026-09-20",
    item_key: key,
    item_type: key,
    practice_kind: key === "program_practice" ? "breathing" : null,
    duration_minutes: key === "program_practice" ? 5 : null,
    mood_score: key === "mood_checkin" ? 4 : null,
    reflection_text: key === "reflection" ? "secret" : null,
    completed_at: "2026-09-20T01:00:00.000Z",
    created_at: "2026-09-20T01:00:00.000Z",
    ...extra,
  };
}

function signedIn() {
  mockUseAuth.mockReturnValue({
    user: { id: "user-1", email: "user@example.com" },
    session: { access_token: "token" },
    loading: false,
    signOut: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
  });
}

function renderPage(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>{ui}</LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-20T05:00:00.000Z"));
  signedIn();
  getWellnessPreferences.mockResolvedValue(PREFS);
  getActiveEnrollment.mockResolvedValue(ENROLLMENT);
  listRecentEnrollments.mockResolvedValue([ENROLLMENT]);
  listDailyPlansInRange.mockResolvedValue([snapshot()]);
  listDailyActivityInRange.mockResolvedValue([
    activity("mood_checkin"),
    activity("daily_insight"),
    activity("program_practice"),
  ]);
  localStorage.setItem("mindful_language", "en");
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("Progress route", () => {
  it("is registered as a protected route", () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../App.tsx"), "utf8");
    expect(source).toContain('path="/progress"');
    expect(source).toMatch(/path="\/progress"[\s\S]{0,120}ProtectedRoute/);
  });

  it("shows Day X of Y from the catalog", async () => {
    renderPage(<ProgressPage />);
    await waitFor(() => expect(screen.getByTestId("progress-day")).toBeTruthy());
    expect(screen.getByTestId("progress-day").textContent).toBe(`Day 2 of ${getProgram("calm-reset").durationDays}`);
  });

  it("shows a completed-program state", async () => {
    const done = { ...ENROLLMENT, status: "completed" as const, current_day: 7, completed_on: "2026-09-20" };
    getActiveEnrollment.mockResolvedValue(null);
    listRecentEnrollments.mockResolvedValue([done]);
    renderPage(<ProgressPage />);
    await waitFor(() => expect(screen.getByTestId("progress-program-complete")).toBeTruthy());
  });

  it("shows a no-enrollment empty state", async () => {
    getActiveEnrollment.mockResolvedValue(null);
    listRecentEnrollments.mockResolvedValue([]);
    listDailyPlansInRange.mockResolvedValue([]);
    listDailyActivityInRange.mockResolvedValue([]);
    renderPage(<ProgressPage />);
    await waitFor(() => expect(screen.getByTestId("progress-empty-enrollment")).toBeTruthy());
    expect(screen.getByTestId("progress-programs-cta")).toBeTruthy();
  });

  it("treats sparse weekly data as an empty-plans state, not a failure", async () => {
    listDailyPlansInRange.mockResolvedValue([]);
    listDailyActivityInRange.mockResolvedValue([]);
    renderPage(<ProgressPage />);
    await waitFor(() => expect(screen.getByTestId("progress-empty-plans")).toBeTruthy());
    expect(screen.queryByTestId("progress-error")).toBeNull();
  });

  it("does not create or complete a Daily Plan while loading Progress", async () => {
    renderPage(<ProgressPage />);
    await waitFor(() => expect(screen.getByTestId("progress-header")).toBeTruthy());
    expect(loadOrCreateDailyPlan).not.toHaveBeenCalled();
    expect(completeWellnessDailyPlan).not.toHaveBeenCalled();
    expect(completeDailyPlanItem).not.toHaveBeenCalled();
  });

  it("renders English, Indonesian, and Japanese Progress copy", async () => {
    renderPage(<ProgressPage />);
    await waitFor(() => expect(screen.getByTestId("progress-insight-count")).toBeTruthy());
    expect(screen.getByText("Daily Insight")).toBeTruthy();
    cleanup();
    localStorage.setItem("mindful_language", "id");
    renderPage(<ProgressPage />);
    await waitFor(() => expect(screen.getByText("Wawasan Harian")).toBeTruthy());
    cleanup();
    localStorage.setItem("mindful_language", "ja");
    renderPage(<ProgressPage />);
    await waitFor(() => expect(screen.getByText("デイリーインサイト")).toBeTruthy());
  });

  it("does not create Daily Plans from the Progress module source", () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "progress.tsx"), "utf8");
    const hook = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../hooks/useProgress.ts"), "utf8");
    expect(source).not.toContain("loadOrCreateDailyPlan");
    expect(source).not.toContain("completeWellnessDailyPlan");
    expect(hook).not.toContain("loadOrCreateDailyPlan");
    expect(hook).not.toContain("completeWellnessDailyPlan");
    expect(hook).toContain("listDailyPlansInRange");
  });

  it("does not show reflection text", async () => {
    listDailyActivityInRange.mockResolvedValue([activity("reflection")]);
    renderPage(<ProgressPage />);
    await waitFor(() => expect(screen.getByTestId("progress-reflection-count")).toBeTruthy());
    expect(screen.queryByText("secret")).toBeNull();
  });
});

describe("Dashboard Progress card", () => {
  it("shows Day X of Y, weekly completed count, streak, and opens /progress", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(<DashboardProgressCard />);
    await waitFor(() => expect(screen.getByTestId("dashboard-progress-card")).toBeTruthy());
    expect(screen.getByTestId("dashboard-progress-day").textContent).toBe(
      `Day 2 of ${getProgram("calm-reset").durationDays}`,
    );
    expect(screen.getByTestId("dashboard-progress-week").textContent).toContain("1");
    expect(screen.getByTestId("dashboard-progress-streak").textContent).toContain("Daily Plan streak");
    await user.click(screen.getByTestId("dashboard-progress-card"));
    expect(setLocation).toHaveBeenCalledWith("/progress");
    expect(loadOrCreateDailyPlan).not.toHaveBeenCalled();
  });
});
