import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/context/LanguageContext";
import {
  ORDERED_ITEM_KEYS,
  buildDailyPlanSnapshot,
  isDailyPlanComplete,
  requiredItemKeys,
} from "@/lib/wellness/dailyPlan";
import type { DailyActivity, DailyPlanSnapshot, ProgramEnrollment, WellnessPreferences } from "@/lib/wellness/types";

const toast = vi.fn();
const setLocation = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));
vi.mock("@/components/BottomNav", () => ({ BottomNav: () => <nav /> }));
vi.mock("@/components/BreathingModal", () => ({ BreathingModal: () => <div data-testid="breathing-modal" /> }));
vi.mock("@/components/MovementSession", () => ({ MovementSession: () => <div data-testid="movement-session" /> }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return { ...actual, useLocation: () => ["/daily-plan", setLocation] };
});

const getActiveEnrollment = vi.fn();
vi.mock("@/lib/wellness/programEnrollments", () => ({
  getActiveEnrollment: (...args: unknown[]) => getActiveEnrollment(...args),
  enrollWellnessProgram: vi.fn(),
  abandonWellnessProgram: vi.fn(),
}));

const getWellnessPreferences = vi.fn();
vi.mock("@/lib/wellness/wellnessPreferences", () => ({
  getWellnessPreferences: (...args: unknown[]) => getWellnessPreferences(...args),
  saveWellnessPreferences: vi.fn(),
}));

const loadOrCreateDailyPlan = vi.fn();
const getDailyPlanForDate = vi.fn();
const completeWellnessDailyPlan = vi.fn();
vi.mock("@/lib/wellness/dailyPlans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wellness/dailyPlans")>();
  return {
    ...actual,
    loadOrCreateDailyPlan: (...args: unknown[]) => loadOrCreateDailyPlan(...args),
    getDailyPlanForDate: (...args: unknown[]) => getDailyPlanForDate(...args),
    completeWellnessDailyPlan: (...args: unknown[]) => completeWellnessDailyPlan(...args),
  };
});

vi.mock("@/lib/wellness/insightHistory", () => ({
  loadAdaptiveInsightSignals: vi.fn(async () => ({ progress: [], insightReads: [], failed: false })),
}));

const listDailyActivity = vi.fn();
const completeDailyPlanItem = vi.fn();
vi.mock("@/lib/wellness/dailyActivity", () => ({
  listDailyActivity: (...args: unknown[]) => listDailyActivity(...args),
  completeDailyPlanItem: (...args: unknown[]) => completeDailyPlanItem(...args),
}));

vi.mock("@/hooks/useLessons", () => ({
  useLessons: () => ({
    data: [
      { id: "local-proc-7", title: "The perfectionism trap", content: "Body", category: "procrastination", reading_time_minutes: 2, sort_order: 1, active: true, created_at: "" },
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Remote", content: "UUID", category: "cbt", reading_time_minutes: 2, sort_order: 2, active: true, created_at: "" },
    ],
    isSuccess: true,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { useAuth } from "@/hooks/useAuth";
import DailyPlanPage from "./daily-plan";

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
  current_day: 1,
  started_on: "2026-09-20",
  completed_on: null,
  created_at: "2026-09-20T00:00:00Z",
  updated_at: "2026-09-20T00:00:00Z",
};

function snapshot(overrides: Partial<DailyPlanSnapshot> = {}): DailyPlanSnapshot {
  const draft = buildDailyPlanSnapshot({
    localDate: "2026-09-20",
    primaryGoal: "stress",
    preferredDurationMinutes: 5,
    selectedLessonId: "local-proc-7",
    enrollment: ENROLLMENT,
  });
  return {
    id: "plan-1",
    user_id: "user-1",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    ...draft,
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
    practice_kind: null,
    duration_minutes: null,
    mood_score: key === "mood_checkin" ? 4 : null,
    reflection_text: null,
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
  signedIn();
  getWellnessPreferences.mockResolvedValue(PREFS);
  getActiveEnrollment.mockResolvedValue(ENROLLMENT);
  loadOrCreateDailyPlan.mockResolvedValue(snapshot());
  getDailyPlanForDate.mockResolvedValue(null);
  listDailyActivity.mockResolvedValue([]);
  completeDailyPlanItem.mockImplementation(async (_user: string, input: { item_key: DailyActivity["item_key"] }) => ({
    activity: activity(input.item_key),
    planComplete: false,
  }));
  completeWellnessDailyPlan.mockResolvedValue({
    plan_id: "plan-1",
    plan_completed: true,
    enrollment_id: "enroll-1",
    program_slug: "calm-reset",
    completed_program_day: 1,
    current_program_day: 2,
    enrollment_status: "active",
    advanced: true,
  });
  localStorage.setItem("mindful_language", "en");
});

afterEach(() => cleanup());

describe("Daily Plan route and empty states", () => {
  it("is registered as a protected route", () => {
    const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../App.tsx"), "utf8");
    expect(source).toContain('path="/daily-plan"');
    expect(source).toMatch(/path="\/daily-plan"[\s\S]{0,120}ProtectedRoute/);
  });

  it("shows a no-active-program empty state with a programs link", async () => {
    getActiveEnrollment.mockResolvedValue(null);
    getDailyPlanForDate.mockResolvedValue(null);
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-empty")).toBeTruthy());
    expect(screen.getByTestId("daily-plan-empty-cta")).toBeTruthy();
  });

  it("shows an authenticated error when signed out", () => {
    mockUseAuth.mockReturnValue({ user: null, session: null, loading: false, signOut: vi.fn(), signIn: vi.fn(), signUp: vi.fn() });
    renderPage(<DailyPlanPage />);
    expect(screen.getByTestId("daily-plan-auth-error")).toBeTruthy();
  });
});

describe("Daily Plan rendering", () => {
  it("shows Day X of Y from the catalog and localized Daily Insight copy", async () => {
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-day")).toBeTruthy());
    expect(screen.getByTestId("daily-plan-day").textContent).toBe("Day 1 of 7");
    expect(screen.getByText("Daily Insight")).toBeTruthy();
    expect(screen.getByText("7-Day Calm Reset")).toBeTruthy();
  });

  it("renders Indonesian Daily Insight terminology", async () => {
    localStorage.setItem("mindful_language", "id");
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByText("Wawasan Harian")).toBeTruthy());
    expect(screen.getByText("Reset Tenang 7 Hari")).toBeTruthy();
  });

  it("renders Japanese Daily Insight terminology", async () => {
    localStorage.setItem("mindful_language", "ja");
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByText("デイリーインサイト")).toBeTruthy());
  });
});

describe("Daily Plan item completion", () => {
  it("saves a mood check-in through the activity module", async () => {
    const user = userEvent.setup();
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-mood-4")).toBeTruthy());
    await user.click(screen.getByTestId("daily-plan-mood-4"));
    await waitFor(() => {
      expect(completeDailyPlanItem).toHaveBeenCalled();
    });
    const payload = completeDailyPlanItem.mock.calls[0][1];
    expect(payload.item_key).toBe("mood_checkin");
    expect(payload.mood_score).toBe(4);
    expect(payload).not.toHaveProperty("user_id");
    expect(completeWellnessDailyPlan).not.toHaveBeenCalled();
  });

  it("marks Daily Insight read without writing lesson feedback", async () => {
    const user = userEvent.setup();
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-mark-insight")).toBeTruthy());
    await user.click(screen.getByTestId("daily-plan-mark-insight"));
    await waitFor(() => expect(completeDailyPlanItem.mock.calls[0][1].item_key).toBe("daily_insight"));
    expect(completeDailyPlanItem.mock.calls[0][1].mood_score).toBeUndefined();
  });

  it("completes program practice through an explicit button", async () => {
    const user = userEvent.setup();
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-complete-practice")).toBeTruthy());
    await user.click(screen.getByTestId("daily-plan-complete-practice"));
    await waitFor(() => expect(completeDailyPlanItem.mock.calls[0][1].item_key).toBe("program_practice"));
  });

  it("saves optional reflection text through the activity module", async () => {
    const user = userEvent.setup();
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-reflection")).toBeTruthy());
    await user.type(screen.getByTestId("daily-plan-reflection"), "A kind note");
    await user.click(screen.getByTestId("daily-plan-save-reflection"));
    await waitFor(() => expect(completeDailyPlanItem.mock.calls[0][1].reflection_text).toBe("A kind note"));
  });

  it("treats persisted activity as completed after refresh", async () => {
    listDailyActivity.mockResolvedValue([activity("mood_checkin")]);
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-item-done-mood_checkin")).toBeTruthy());
    expect((screen.getByTestId("daily-plan-mood-3") as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not call the completion RPC until every required activity exists", async () => {
    listDailyActivity.mockResolvedValue([activity("mood_checkin")]);
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-item-done-mood_checkin")).toBeTruthy());
    expect(completeWellnessDailyPlan).not.toHaveBeenCalled();
  });

  it("calls the completion RPC after all required activities exist", async () => {
    listDailyActivity.mockResolvedValue(ORDERED_ITEM_KEYS.map((key) => activity(key)));
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(completeWellnessDailyPlan).toHaveBeenCalledWith("plan-1"));
  });

  it("does not call the completion RPC twice for an already completed plan", async () => {
    listDailyActivity.mockResolvedValue(ORDERED_ITEM_KEYS.map((key) => activity(key)));
    loadOrCreateDailyPlan.mockResolvedValue(snapshot({ completed_at: "2026-09-20T02:00:00.000Z" }));
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-completed-today")).toBeTruthy());
    expect(completeWellnessDailyPlan).not.toHaveBeenCalled();
  });

  it("reuses the stored Daily Insight when today’s snapshot already exists", async () => {
    const stored = snapshot({ lesson_id: "local-proc-7", completed_at: "2026-09-20T02:00:00.000Z" });
    getDailyPlanForDate.mockResolvedValue(stored);
    loadOrCreateDailyPlan.mockResolvedValue(stored);
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-completed-today")).toBeTruthy());
    expect(loadOrCreateDailyPlan).not.toHaveBeenCalled();
    expect(screen.getByTestId("daily-plan-insight-reason").textContent).toContain("Daily Plan");
  });

  it("links to /progress after the Daily Plan is completed", async () => {
    const user = userEvent.setup();
    listDailyActivity.mockResolvedValue(ORDERED_ITEM_KEYS.map((key) => activity(key)));
    loadOrCreateDailyPlan.mockResolvedValue(snapshot({ completed_at: "2026-09-20T02:00:00.000Z" }));
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-view-progress")).toBeTruthy());
    await user.click(screen.getByTestId("daily-plan-view-progress"));
    expect(setLocation).toHaveBeenCalledWith("/progress");
  });

  it("shows the final-program-completed state on the last catalog day", async () => {
    loadOrCreateDailyPlan.mockResolvedValue(
      snapshot({
        program_day: 7,
        completed_at: "2026-09-20T02:00:00.000Z",
      }),
    );
    listDailyActivity.mockResolvedValue(ORDERED_ITEM_KEYS.map((key) => activity(key)));
    renderPage(<DailyPlanPage />);
    await waitFor(() => expect(screen.getByTestId("daily-plan-program-complete")).toBeTruthy());
  });
});

describe("required-item calculation", () => {
  it("requires every snapshot-required key", () => {
    const plan = snapshot();
    expect(requiredItemKeys(plan.items)).toEqual([...ORDERED_ITEM_KEYS]);
    expect(isDailyPlanComplete(plan.items, ["mood_checkin"])).toBe(false);
    expect(isDailyPlanComplete(plan.items, ORDERED_ITEM_KEYS)).toBe(true);
  });
});
