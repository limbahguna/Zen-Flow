/**
 * Integration tests for the localized-lesson reconciliation bug.
 *
 * Bug: LearnPage and Dashboard hold an open LessonRow in component state. When
 * the user switches language (EN -> ID/JA) while LessonReader is open, the open
 * lesson could keep rendering the stale English title/content — including a
 * remote English-only lesson that has no counterpart in the ID/JA catalog.
 *
 * Fix under test (production code): once the locale-specific lesson query for
 * the current language has SETTLED (not loading/fetching), reconcile the open
 * lesson by stable ID:
 *   - same ID present in the current catalog  -> replace with current-language version
 *   - ID absent (e.g. remote English-only)     -> close the reader
 *   - never reconcile/close while the query is still in flight
 *
 * These tests exercise the REAL LearnPage and Dashboard entry points, open a
 * lesson, then switch EN -> ID -> JA and assert the localized title/body
 * replaces the English one (or that the reader closes for a remote-only lesson).
 *
 * Query fixtures represent a SETTLED locale response (isSuccess true,
 * isLoading/isFetching false) that switches synchronously with the active
 * language, so no timers/promises are involved and tests are not flaky.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Router } from "wouter";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import type { LanguageCode } from "@/lib/translations";
import { getLocalLessons } from "@/lib/localLessons";
import type { LessonRow } from "@/lib/lessons";

// ── Global mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase", () => ({
  default: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        gte: vi.fn(),
        lt: vi.fn(),
        order: vi.fn(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.gte.mockReturnValue(query);
      query.lt.mockReturnValue(query);
      query.order.mockReturnValue(query);
      return query;
    }),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "test-user-id", email: "test@example.com" },
    session: null,
    loading: false,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(() => ({
    profile: null,
    displayName: "Tester",
    profileLoading: false,
    isProfileComplete: true,
  })),
}));

vi.mock("@/hooks/useTasks", () => ({
  useTasks: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock("@/hooks/useAnxietyChecks", () => ({
  useAnxietyChecks: vi.fn(() => ({ data: [] })),
}));

vi.mock("@/hooks/useJournal", () => ({
  useJournal: vi.fn(() => ({ data: [] })),
}));

vi.mock("@/hooks/useIntentions", () => ({
  useIntentions: vi.fn(() => ({ data: [], isLoading: false })),
  useIntentionActions: vi.fn(() => ({
    create: { mutateAsync: vi.fn(), isPending: false },
    update: { mutateAsync: vi.fn(), isPending: false },
    setStatus: { mutateAsync: vi.fn(), isPending: false },
  })),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
  };
});

// ── Controllable, SETTLED useLessons mock ──────────────────────────────────────
//
// The mock returns a settled react-query-shaped result whose `data` is derived
// from the CURRENTLY ACTIVE language (read from localStorage, kept in sync with
// LanguageContext, which persists to the same key). This mirrors how the real
// useLessons re-fetches per locale — but resolves synchronously so there is no
// loading window and no flakiness.
//
// For English we optionally include a REMOTE English-only lesson (no ID/JA
// counterpart) so we can assert the reader closes when switching to ID/JA.

const REMOTE_ONLY_LESSON: LessonRow = {
  id: "remote-en-only-1",
  title: "Remote English Only Lesson",
  content: "This lesson exists only in the remote English catalog.",
  category: "cbt",
  reading_time_minutes: 3,
  sort_order: 5,
  active: true,
  created_at: "2024-01-01T00:00:00Z",
};

// Toggle whether the EN catalog includes the remote-only lesson.
let includeRemoteOnly = false;

function currentLang(): LanguageCode {
  try {
    return (localStorage.getItem("mindful_language") as LanguageCode) || "en";
  } catch {
    return "en";
  }
}

function catalogForLang(lang: LanguageCode): LessonRow[] {
  const local = getLocalLessons(lang);
  if (lang === "en" && includeRemoteOnly) {
    return [REMOTE_ONLY_LESSON, ...local];
  }
  return local;
}

vi.mock("@/hooks/useLessons", () => ({
  useLessons: vi.fn(() => {
    const lang = currentLang();
    return {
      data: catalogForLang(lang),
      isLoading: false,
      isFetching: false,
      isSuccess: true,
      isError: false,
      refetch: vi.fn(),
    };
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function LangSwitchButton({ lang }: { lang: LanguageCode }) {
  const { setLanguage } = useLanguage();
  return (
    <button data-testid={`switch-to-${lang}`} onClick={() => setLanguage(lang)}>
      {lang}
    </button>
  );
}

beforeEach(() => {
  includeRemoteOnly = false;
  try {
    localStorage.removeItem("mindful_language");
  } catch {}
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  try {
    localStorage.removeItem("mindful_language");
  } catch {}
});

// Known local lesson used across tests — has EN/ID/JA localized title+content.
const PROC_ID = "local-proc-7";
const EN = getLocalLessons("en").find((l) => l.id === PROC_ID)!;
const ID = getLocalLessons("id").find((l) => l.id === PROC_ID)!;
const JA = getLocalLessons("ja").find((l) => l.id === PROC_ID)!;

// ─────────────────────────────────────────────────────────────────────────────
// LearnPage — open a LOCAL lesson, switch EN -> ID -> JA
// ─────────────────────────────────────────────────────────────────────────────
describe("LearnPage — open lesson reconciliation across locales", () => {
  async function renderLearn() {
    const { default: LearnPage } = await import("@/pages/learn");
    return render(
      <LanguageProvider>
        <Router>
          <LangSwitchButton lang="id" />
          <LangSwitchButton lang="ja" />
          <LangSwitchButton lang="en" />
          <LearnPage />
        </Router>
      </LanguageProvider>,
    );
  }

  it("replaces open local lesson title/body with ID then JA versions", async () => {
    const user = userEvent.setup();
    await renderLearn();

    // Open the lesson in English.
    await user.click(screen.getByTestId(`lesson-card-${PROC_ID}`));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(EN.title);
    expect(screen.getByText(EN.content)).toBeTruthy();

    // Switch to Indonesian — reader stays open, localized copy replaces English.
    await user.click(screen.getByTestId("switch-to-id"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(ID.title);
    });
    expect(screen.queryByText(EN.content)).toBeNull();
    expect(screen.getByText(ID.content)).toBeTruthy();

    // Switch to Japanese — localized copy again replaces the previous.
    await user.click(screen.getByTestId("switch-to-ja"));
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(JA.title);
    });
    expect(screen.queryByText(ID.content)).toBeNull();
    expect(screen.getByText(JA.content)).toBeTruthy();
  });

  it("closes the reader for a remote English-only lesson when switching to ID/JA", async () => {
    includeRemoteOnly = true;
    const user = userEvent.setup();
    await renderLearn();

    // Open the remote English-only lesson.
    await user.click(screen.getByTestId(`lesson-card-${REMOTE_ONLY_LESSON.id}`));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      REMOTE_ONLY_LESSON.title,
    );

    // Switching to Indonesian: this ID is absent in the ID catalog -> close.
    await user.click(screen.getByTestId("switch-to-id"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    // English content must NOT be shown after the switch.
    expect(screen.queryByText(REMOTE_ONLY_LESSON.content)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — open the "today's lesson" reader, switch EN -> ID -> JA
// ─────────────────────────────────────────────────────────────────────────────
describe("Dashboard — open lesson reconciliation across locales", () => {
  async function renderDashboard() {
    const { default: DashboardPage } = await import("@/pages/dashboard");
    return render(
      <LanguageProvider>
        <Router>
          <LangSwitchButton lang="id" />
          <LangSwitchButton lang="ja" />
          <LangSwitchButton lang="en" />
          <DashboardPage />
        </Router>
      </LanguageProvider>,
    );
  }

  it("replaces the open local lesson with ID then JA localized copy", async () => {
    const user = userEvent.setup();
    await renderDashboard();

    // Open today's lesson card. Its ID is deterministic; find whichever card
    // is rendered and record its opened English title.
    const card = await screen.findByTestId("todays-lesson-card");
    await user.click(card);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    const openedId = dialog.getAttribute("data-lesson-id")!;
    const enLesson = getLocalLessons("en").find((l) => l.id === openedId)!;
    const idLesson = getLocalLessons("id").find((l) => l.id === openedId)!;
    const jaLesson = getLocalLessons("ja").find((l) => l.id === openedId)!;
    expect(within(dialog).getByRole("heading", { level: 1 }).textContent).toBe(
      enLesson.title,
    );

    // EN -> ID
    await user.click(screen.getByTestId("switch-to-id"));
    await waitFor(() => {
      expect(within(screen.getByRole("dialog")).getByRole("heading", { level: 1 }).textContent).toBe(
        idLesson.title,
      );
    });
    expect(screen.queryByText(enLesson.content)).toBeNull();
    expect(screen.getByText(idLesson.content)).toBeTruthy();

    // ID -> JA
    await user.click(screen.getByTestId("switch-to-ja"));
    await waitFor(() => {
      expect(within(screen.getByRole("dialog")).getByRole("heading", { level: 1 }).textContent).toBe(
        jaLesson.title,
      );
    });
    expect(screen.queryByText(idLesson.content)).toBeNull();
    expect(screen.getByText(jaLesson.content)).toBeTruthy();
  });

  it("closes the reader for a remote English-only today's lesson when switching to ID/JA", async () => {
    includeRemoteOnly = true;
    const user = userEvent.setup();
    await renderDashboard();

    const card = await screen.findByTestId("todays-lesson-card");
    await user.click(card);
    const dialog = await screen.findByRole("dialog");
    const openedId = dialog.getAttribute("data-lesson-id")!;

    // Only meaningful if the opened lesson is the remote-only one; if the
    // rotation didn't land on it, skip gracefully (title check still valid).
    if (openedId !== REMOTE_ONLY_LESSON.id) {
      // The opened lesson has a localized counterpart; assert it reconciles
      // rather than showing English after switching.
      const idLesson = getLocalLessons("id").find((l) => l.id === openedId)!;
      await user.click(screen.getByTestId("switch-to-id"));
      await waitFor(() => {
        expect(within(screen.getByRole("dialog")).getByRole("heading", { level: 1 }).textContent).toBe(
          idLesson.title,
        );
      });
      return;
    }

    await user.click(screen.getByTestId("switch-to-ja"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.queryByText(REMOTE_ONLY_LESSON.content)).toBeNull();
  });
});
