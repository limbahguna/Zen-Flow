import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { LanguageProvider } from "@/context/LanguageContext";

const fixture = vi.hoisted(() => ({
  messages: [
    { id: "user-message", role: "user" as const, content: "I need help" },
    {
      id: "assistant-message",
      role: "assistant" as const,
      content: "Selected assistant guidance",
      reportToken: "server-issued-report-token",
    },
  ],
  setMessages: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "reporting-user" },
    session: { access_token: "test-access-token" },
    loading: false,
  })),
}));

vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn(() => ({ data: [] })) }));
vi.mock("@/hooks/useAnxietyChecks", () => ({
  useAnxietyChecks: vi.fn(() => ({ data: [] })),
}));
vi.mock("@/hooks/useJournal", () => ({ useJournal: vi.fn(() => ({ data: [] })) }));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(() => ({ data: { remainingToday: 5 } })),
}));
vi.mock("@/context/CoachContext", () => ({
  useCoachContext: vi.fn(() => ({
    messages: fixture.messages,
    setMessages: fixture.setMessages,
  })),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: fixture.toast })),
}));
vi.mock("@/lib/apiRuntime", () => ({
  appApiUrl: (path: string) => path,
}));
vi.mock("@/components/CrisisModal", () => ({ CrisisModal: () => null }));
vi.mock("@/components/BottomNav", () => ({ BottomNav: () => <nav /> }));

function renderCoach(language = "en") {
  localStorage.setItem("mindful_language", language);
  return render(
    <LanguageProvider>
      <CoachPage />
    </LanguageProvider>,
  );
}

let CoachPage: (typeof import("./coach"))["default"];

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.removeItem("mindful_language");
  fixture.messages = [
    { id: "user-message", role: "user", content: "I need help" },
    {
      id: "assistant-message",
      role: "assistant",
      content: "Selected assistant guidance",
      reportToken: "server-issued-report-token",
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 204 })),
  );
  vi.stubGlobal("crypto", { randomUUID: () => "e7f3b1c4-6b7a-4f9d-9db6-43e414d2a1a2" });
  Element.prototype.scrollIntoView = vi.fn();
  CoachPage = (await import("./coach")).default;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.removeItem("mindful_language");
});

describe("Coach AI response reports", () => {
  it("renders report controls only for assistant responses and submits the selected response", async () => {
    const user = userEvent.setup();
    renderCoach();

    expect(screen.getByTestId("report-button-assistant-message")).toBeTruthy();
    expect(screen.queryByTestId("report-button-user-message")).toBeNull();

    await user.click(screen.getByTestId("report-button-assistant-message"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.click(screen.getByLabelText("Harmful or unsafe"));
    await user.type(screen.getByTestId("coach-report-note"), "Needs review");
    await user.click(screen.getByTestId("coach-report-submit"));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toBe("/api/ai/reports");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer test-access-token",
    );
    const payload = JSON.parse(String(init?.body));
    expect(payload).toEqual({
      category: "harmful_or_unsafe",
      optionalNote: "Needs review",
      reportClientId: "e7f3b1c4-6b7a-4f9d-9db6-43e414d2a1a2",
      reportToken: "server-issued-report-token",
    });
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("email");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByTestId("report-button-assistant-message")).toHaveProperty("disabled", true);
    expect(fixture.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Report submitted" }),
    );
  }, 20_000);

  it.each([
    ["en", "Report an AI response"],
    ["id", "Laporkan respons AI"],
    ["ja", "AIの回答を報告"],
  ])("shows a localized accessible dialog in %s", async (language, title) => {
    const user = userEvent.setup();
    renderCoach(language);

    await user.click(screen.getByTestId("report-button-assistant-message"));
    expect(screen.getByRole("dialog", { name: title })).toBeTruthy();
    expect(screen.getByTestId("coach-report-note")).toBeTruthy();
  });

  it("keeps the dialog open and explains a failed submission", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    const user = userEvent.setup();
    renderCoach();

    await user.click(screen.getByTestId("report-button-assistant-message"));
    await user.click(screen.getByLabelText("Harmful or unsafe"));
    await user.click(screen.getByTestId("coach-report-submit"));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "We could not submit your report. Please try again.",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("report-button-assistant-message")).toHaveProperty("disabled", false);
  });
});