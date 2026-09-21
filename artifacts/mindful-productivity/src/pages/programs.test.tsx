import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/context/LanguageContext";
import { getProgram } from "@/lib/wellness/programCatalog";
import { t } from "@/lib/translations";
import type { ProgramEnrollment, WellnessPreferences } from "@/lib/wellness/types";

const toast = vi.fn();
const setLocation = vi.fn();
const routeParams = { slug: "calm-reset" };

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

vi.mock("@/components/BottomNav", () => ({
  BottomNav: () => <nav data-testid="bottom-nav" />,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    ...actual,
    useLocation: () => ["/programs", setLocation],
    useRoute: (pattern: string) =>
      pattern === "/programs/:slug" ? [true, routeParams] : [false, null],
  };
});

const getActiveEnrollment = vi.fn();
const enrollWellnessProgram = vi.fn();
const abandonWellnessProgram = vi.fn();
vi.mock("@/lib/wellness/programEnrollments", () => ({
  getActiveEnrollment: (...args: unknown[]) => getActiveEnrollment(...args),
  enrollWellnessProgram: (...args: unknown[]) => enrollWellnessProgram(...args),
  abandonWellnessProgram: (...args: unknown[]) => abandonWellnessProgram(...args),
}));

const getWellnessPreferences = vi.fn();
const saveWellnessPreferences = vi.fn();
vi.mock("@/lib/wellness/wellnessPreferences", () => ({
  getWellnessPreferences: (...args: unknown[]) => getWellnessPreferences(...args),
  saveWellnessPreferences: (...args: unknown[]) => saveWellnessPreferences(...args),
}));

import { useAuth } from "@/hooks/useAuth";
import ProgramsPage from "./programs";
import ProgramDetailPage from "./program-detail";
import { DashboardProgramCard } from "@/components/programs/DashboardProgramCard";

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

function enrollment(overrides: Partial<ProgramEnrollment> = {}): ProgramEnrollment {
  return {
    id: "enroll-1",
    user_id: "user-1",
    program_slug: "calm-reset",
    status: "active",
    current_day: 3,
    started_on: "2026-09-18",
    completed_on: null,
    created_at: "2026-09-18T00:00:00Z",
    updated_at: "2026-09-18T00:00:00Z",
    ...overrides,
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

function signedOut() {
  mockUseAuth.mockReturnValue({
    user: null,
    session: null,
    loading: false,
    signOut: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
  });
}

function renderPage(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>{ui}</LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  routeParams.slug = "calm-reset";
  signedIn();
  getActiveEnrollment.mockResolvedValue(null);
  getWellnessPreferences.mockResolvedValue(PREFS);
  enrollWellnessProgram.mockResolvedValue({
    enrollment_id: "enroll-1",
    program_slug: "calm-reset",
    status: "active",
    current_day: 1,
    started_on: "2026-09-20",
    already_active: false,
  });
  abandonWellnessProgram.mockResolvedValue({
    enrollment_id: "enroll-1",
    status: "abandoned",
    already_abandoned: false,
  });
  try {
    localStorage.setItem("mindful_language", "en");
  } catch {
    // ignore
  }
});

afterEach(() => {
  cleanup();
});

describe("Programs page", () => {
  it("renders all three catalog programs", async () => {
    renderPage(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("program-card-calm-reset")).toBeTruthy();
    });
    expect(screen.getByTestId("program-card-better-sleep")).toBeTruthy();
    expect(screen.getByTestId("program-card-focus-habit")).toBeTruthy();
    expect(screen.getByText("7-Day Calm Reset")).toBeTruthy();
    expect(screen.getByText("14-Day Better Sleep")).toBeTruthy();
    expect(screen.getByText("21-Day Focus & Habit")).toBeTruthy();
    expect(screen.getByText("7-day program")).toBeTruthy();
    expect(screen.getByText("14-day program")).toBeTruthy();
    expect(screen.getByText("21-day program")).toBeTruthy();
  });

  it("localizes program names and duration from the catalog", async () => {
    localStorage.setItem("mindful_language", "id");
    renderPage(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByText("Reset Tenang 7 Hari")).toBeTruthy();
    });
    expect(screen.getByText("Tidur Lebih Baik 14 Hari")).toBeTruthy();
    expect(screen.getByText("Fokus & Kebiasaan 21 Hari")).toBeTruthy();
    expect(screen.getByText("Program 7 hari")).toBeTruthy();
  });

  it("shows Day X of Y from the catalog duration", async () => {
    getActiveEnrollment.mockResolvedValue(enrollment({ current_day: 3 }));
    renderPage(<ProgramsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("active-program-day").textContent).toBe(
        `Day 3 of ${getProgram("calm-reset").durationDays}`,
      );
    });
  });

  it("asks for confirmation before abandoning and then calls the RPC wrapper", async () => {
    getActiveEnrollment.mockResolvedValue(enrollment());
    const user = userEvent.setup();
    renderPage(<ProgramsPage />);
    await waitFor(() => expect(screen.getByTestId("program-abandon")).toBeTruthy());
    await user.click(screen.getByTestId("program-abandon"));
    expect(abandonWellnessProgram).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("program-abandon-confirm"));
    await waitFor(() => {
      expect(abandonWellnessProgram).toHaveBeenCalledWith("enroll-1");
    });
  });

  it("shows an authenticated error when signed out", () => {
    signedOut();
    renderPage(<ProgramsPage />);
    expect(screen.getByTestId("programs-auth-error")).toBeTruthy();
  });

  it("shows a network error state", async () => {
    getActiveEnrollment.mockRejectedValue(new Error("network down"));
    renderPage(<ProgramsPage />);
    await waitFor(() => expect(screen.getByTestId("programs-error")).toBeTruthy());
  });
});

describe("Program detail enrollment", () => {
  it("shows preference setup when preferences are missing", async () => {
    getWellnessPreferences.mockResolvedValue(null);
    renderPage(<ProgramDetailPage />);
    await waitFor(() => expect(screen.getByTestId("wellness-prefs-form")).toBeTruthy());
    expect(screen.queryByTestId("program-start")).toBeNull();
    expect((screen.getByTestId("prefs-timezone") as HTMLInputElement).value.length).toBeGreaterThan(0);
  });

  it("enrolls through enrollWellnessProgram after preferences exist", async () => {
    const user = userEvent.setup();
    renderPage(<ProgramDetailPage />);
    await waitFor(() => expect(screen.getByTestId("program-start")).toBeTruthy());
    await user.click(screen.getByTestId("program-start"));
    await waitFor(() => {
      expect(enrollWellnessProgram).toHaveBeenCalledWith("calm-reset");
    });
    expect(toast).toHaveBeenCalledWith({ title: t("en", "programs.enroll.success") });
  });

  it("treats same-program already_active as success, not a new insert", async () => {
    enrollWellnessProgram.mockResolvedValue({
      enrollment_id: "enroll-1",
      program_slug: "calm-reset",
      status: "active",
      current_day: 4,
      started_on: "2026-09-18",
      already_active: true,
    });
    const user = userEvent.setup();
    renderPage(<ProgramDetailPage />);
    await waitFor(() => expect(screen.getByTestId("program-start")).toBeTruthy());
    await user.click(screen.getByTestId("program-start"));
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: t("en", "programs.enroll.alreadyActive"),
      });
    });
    expect(abandonWellnessProgram).not.toHaveBeenCalled();
  });

  it("does not silently abandon another active program", async () => {
    getActiveEnrollment.mockResolvedValue(
      enrollment({ program_slug: "better-sleep", current_day: 2 }),
    );
    enrollWellnessProgram.mockRejectedValue({ message: "Another program is already active" });
    const user = userEvent.setup();
    renderPage(<ProgramDetailPage />);
    await waitFor(() => expect(screen.getByTestId("program-start")).toBeTruthy());
    await user.click(screen.getByTestId("program-start"));
    await waitFor(() => expect(screen.getByTestId("program-conflict")).toBeTruthy());
    expect(abandonWellnessProgram).not.toHaveBeenCalled();
    expect(screen.getByTestId("program-conflict-continue")).toBeTruthy();
  });
});

describe("Dashboard program entry", () => {
  it("asks the user to choose a program when none is active", async () => {
    renderPage(<DashboardProgramCard />);
    await waitFor(() => expect(screen.getByTestId("dashboard-program-card")).toBeTruthy());
    expect(screen.getByText("Choose your program")).toBeTruthy();
  });

  it("shows the active program name and Day X of Y", async () => {
    getActiveEnrollment.mockResolvedValue(enrollment({ current_day: 5 }));
    renderPage(<DashboardProgramCard />);
    await waitFor(() => expect(screen.getByTestId("dashboard-program-day")).toBeTruthy());
    expect(screen.getByText("7-Day Calm Reset")).toBeTruthy();
    expect(screen.getByTestId("dashboard-program-day").textContent).toBe(
      `Day 5 of ${getProgram("calm-reset").durationDays}`,
    );
  });

  it("opens /daily-plan from the active dashboard program card", async () => {
    getActiveEnrollment.mockResolvedValue(enrollment({ current_day: 1 }));
    const user = userEvent.setup();
    renderPage(<DashboardProgramCard />);
    await waitFor(() => expect(screen.getByTestId("dashboard-program-card")).toBeTruthy());
    await user.click(screen.getByTestId("dashboard-program-card"));
    expect(setLocation).toHaveBeenCalledWith("/daily-plan");
  });
});

describe("Programs Continue Program", () => {
  it("opens /daily-plan", async () => {
    getActiveEnrollment.mockResolvedValue(enrollment({ current_day: 1 }));
    const user = userEvent.setup();
    renderPage(<ProgramsPage />);
    await waitFor(() => expect(screen.getByTestId("program-continue")).toBeTruthy());
    await user.click(screen.getByTestId("program-continue"));
    expect(setLocation).toHaveBeenCalledWith("/daily-plan");
  });

  it("opens /progress from View Progress", async () => {
    getActiveEnrollment.mockResolvedValue(enrollment({ current_day: 2 }));
    const user = userEvent.setup();
    renderPage(<ProgramsPage />);
    await waitFor(() => expect(screen.getByTestId("program-view-progress")).toBeTruthy());
    await user.click(screen.getByTestId("program-view-progress"));
    expect(setLocation).toHaveBeenCalledWith("/progress");
  });
});
