import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/context/LanguageContext";

const subscription = vi.hoisted(() => ({
  remainingThisMonth: 7,
  monthlyLimit: 10,
}));
const messages = vi.hoisted(() => ({
  list: [] as Array<{ id: string; role: "user" | "assistant"; content: string }>,
  setMessages: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "coach-user" },
    session: { access_token: "test-access-token" },
    loading: false,
  })),
}));
vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn(() => ({ data: [] })) }));
vi.mock("@/hooks/useAnxietyChecks", () => ({ useAnxietyChecks: vi.fn(() => ({ data: [] })) }));
vi.mock("@/hooks/useJournal", () => ({ useJournal: vi.fn(() => ({ data: [] })) }));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(() => ({ data: subscription })),
}));
vi.mock("@/context/CoachContext", () => ({
  useCoachContext: vi.fn(() => ({ messages: messages.list, setMessages: messages.setMessages })),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));
vi.mock("@/lib/apiRuntime", () => ({ appApiUrl: (path: string) => path }));

class FakeRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start() {}
  stop() {
    this.onresult?.({ results: [[{ transcript: "I need a quiet minute" }]] });
    this.onend?.();
  }
}

let CoachPage: (typeof import("./coach"))["default"];
const speak = vi.fn();

function renderCoach() {
  localStorage.setItem("mindful_language", "en");
  return render(
    <LanguageProvider>
      <CoachPage />
    </LanguageProvider>,
  );
}

beforeEach(async () => {
  cleanup();
  localStorage.clear();
  subscription.remainingThisMonth = 7;
  messages.list = [];
  messages.setMessages.mockReset();
  speak.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), getVoices: () => [], speak });
  CoachPage = (await import("./coach")).default;
});

afterEach(() => {
  document.documentElement.removeAttribute("dir");
  vi.unstubAllGlobals();
});

describe("Companion voice", () => {
  it("shows the mic when speech recognition exists", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    renderCoach();
    expect(await screen.findByTestId("coach-mic")).toBeTruthy();
    expect(screen.queryByTestId("coach-voice-unsupported")).toBeNull();
    expect(screen.getByTestId("coach-composer").querySelector("form")?.className).not.toContain("flex-row-reverse");
  });

  it("explains that typing still works when voice is unavailable", async () => {
    renderCoach();
    expect(await screen.findByTestId("coach-voice-unsupported")).toBeTruthy();
    expect(screen.queryByTestId("coach-mic")).toBeNull();
  });

  it("disables the mic when the monthly quota is used up", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    subscription.remainingThisMonth = 0;
    renderCoach();
    const mic = await screen.findByTestId("coach-mic");
    await waitFor(() => expect((mic as HTMLButtonElement).disabled).toBe(true));
  });

  it("keeps the transcript editable and sends it through the coach path", async () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reply: "Take one slow breath.", remaining: 6, dailyLimit: 10, plan: "free" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderCoach();
    await user.click(await screen.findByTestId("coach-mic"));
    await user.click(screen.getByTestId("coach-mic"));
    const field = screen.getByTestId("coach-input") as HTMLTextAreaElement;
    await waitFor(() => expect(field.value).toBe("I need a quiet minute"));
    await user.type(field, " please");
    await user.click(screen.getByTestId("coach-send"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/ai/coach");
    expect(body.history.at(-1).content).toContain("quiet minute");
    expect(speak).not.toHaveBeenCalled();
  });

  it("opens crisis help instead of speaking a reply", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderCoach();
    await user.type(screen.getByTestId("coach-input"), "I want to die");
    await user.click(screen.getByTestId("coach-send"));
    expect(await screen.findByTestId("crisis-modal")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it("follows document direction without reversing the composer", async () => {
    localStorage.setItem("mindful_language", "ar");
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    render(
      <LanguageProvider>
        <CoachPage />
      </LanguageProvider>,
    );
    const form = (await screen.findByTestId("coach-mic")).closest("form");
    expect(form?.className).not.toContain("flex-row-reverse");
    expect(document.documentElement.dir).toBe("rtl");
  });
});
