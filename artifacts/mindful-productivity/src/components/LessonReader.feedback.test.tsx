import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/context/LanguageContext";
import { LessonReader } from "./LessonReader";
import type { LessonRow } from "@/lib/lessons";
import { saveLessonProgress } from "@/lib/lessons";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const toast = vi.fn();
const saveLessonProgressMock = vi.mocked(saveLessonProgress);
const useAuthMock = vi.mocked(useAuth);

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(),
}));

vi.mock("@/lib/lessons", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lessons")>();
  return {
    ...actual,
    saveLessonProgress: vi.fn(),
    logSanitizedLessonProgressError: vi.fn(),
  };
});

const uuidLesson: LessonRow = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Remote lesson",
  content: "Remote body",
  category: "habits",
  reading_time_minutes: 2,
  sort_order: 1,
  active: true,
  created_at: "2024-01-01T00:00:00Z",
};

const localLesson: LessonRow = {
  id: "local-proc-7",
  title: "The perfectionism trap",
  content: "Waiting until conditions are perfect is a form of avoidance.",
  category: "procrastination",
  reading_time_minutes: 2,
  sort_order: 107,
  active: true,
  created_at: "2024-01-01T00:00:00Z",
};

function renderReader(lesson: LessonRow) {
  return render(
    <LanguageProvider>
      <LessonReader lesson={lesson} onClose={() => {}} />
    </LanguageProvider>,
  );
}

describe("LessonReader feedback", () => {
  beforeEach(() => {
    toast.mockReset();
    saveLessonProgressMock.mockReset();
    saveLessonProgressMock.mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      user: { id: "11111111-1111-4111-8111-111111111111", email: "test@example.com" },
      session: { access_token: "test-access-token" },
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    } as never);
    vi.mocked(useToast).mockReturnValue({ toast } as never);
    localStorage.removeItem("mindful_language");
  });

  afterEach(() => {
    cleanup();
  });

  it("saves Yes feedback for a UUID lesson and shows thanks", async () => {
    const user = userEvent.setup();
    renderReader(uuidLesson);
    await user.click(screen.getByTestId("button-helpful-yes"));
    await waitFor(() => {
      expect(saveLessonProgressMock).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        uuidLesson.id,
        true,
      );
    });
    expect(await screen.findByText("Thanks for your feedback")).toBeTruthy();
    expect(toast).not.toHaveBeenCalled();
  });

  it("saves No feedback for a bundled local-* lesson and shows thanks", async () => {
    const user = userEvent.setup();
    renderReader(localLesson);
    await user.click(screen.getByTestId("button-helpful-no"));
    await waitFor(() => {
      expect(saveLessonProgressMock).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        "local-proc-7",
        false,
      );
    });
    expect(await screen.findByText("Thanks for your feedback")).toBeTruthy();
    expect(toast).not.toHaveBeenCalled();
  });

  it("does not submit again after a successful save (duplicate click)", async () => {
    const user = userEvent.setup();
    renderReader(localLesson);
    await user.click(screen.getByTestId("button-helpful-yes"));
    await screen.findByText("Thanks for your feedback");
    expect(screen.queryByTestId("button-helpful-yes")).toBeNull();
    expect(saveLessonProgressMock).toHaveBeenCalledTimes(1);
  });

  it("does not save when the user is unauthenticated", async () => {
    useAuthMock.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    } as never);
    const user = userEvent.setup();
    renderReader(localLesson);
    await user.click(screen.getByTestId("button-helpful-yes"));
    expect(saveLessonProgressMock).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(screen.getByTestId("button-helpful-yes")).toBeTruthy();
  });

  it("shows the error toast when Supabase/RLS rejects the save", async () => {
    saveLessonProgressMock.mockRejectedValue({
      code: "42501",
      message: "new row violates row-level security policy for table \"lesson_progress\"",
    });
    const user = userEvent.setup();
    renderReader(uuidLesson);
    await user.click(screen.getByTestId("button-helpful-yes"));
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: "Couldn't save",
        description: "Something went wrong.",
        variant: "destructive",
      });
    });
    expect(screen.getByTestId("button-helpful-yes")).toBeTruthy();
  });
});
