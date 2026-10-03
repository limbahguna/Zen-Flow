/**
 * A Journal reflection opens the existing Intention form blank.
 * Question 5 stays in the Journal. It is not copied into the title.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import IntentionsPage from "./intentions";
import { openBlankIntention } from "@/lib/intentionSeed";

const intentionRows = vi.hoisted(() => ({ data: [] as Array<Record<string, unknown>> }));

const create = vi.fn(async (_input: { title: string }) => ({ id: "intention-1" }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useIntentions", () => ({
  useIntentions: () => ({ data: intentionRows.data, isLoading: false, error: null }),
  useIntentionActions: () => ({
    create: { mutateAsync: create, isPending: false },
    update: { mutateAsync: vi.fn(), isPending: false },
    setStatus: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("@/lib/intentionNotifications", () => ({
  cancelIntentionReminder: vi.fn(),
  scheduleIntentionReminder: vi.fn(async () => true),
}));

vi.mock("@/lib/intentions", () => ({
  createIntention: vi.fn(),
  listIntentions: vi.fn(async () => []),
  updateIntention: vi.fn(),
  updateIntentionStatus: vi.fn(),
}));

function LanguageSwitch({ code }: { code: "en" | "id" | "ja" }) {
  const { setLanguage } = useLanguage();
  return (
    <button data-testid={`switch-language-${code}`} onClick={() => setLanguage(code)}>
      {code}
    </button>
  );
}

function renderIntentions() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <LanguageSwitch code="id" />
        <LanguageSwitch code="ja" />
        <IntentionsPage />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

function titleValue(): string {
  return (screen.getByTestId("intention-title") as HTMLInputElement).value;
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  intentionRows.data = [];
  create.mockReset();
});

describe("blank intention form from a journal reflection", () => {
  it("opens an empty editable title for a non-actionable perspective", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("journal_perspective_fixture", "I may not be good enough");
    openBlankIntention();
    renderIntentions();

    expect(titleValue()).toBe("");
    expect(screen.getByTestId("intention-title").getAttribute("placeholder")).toBe("One small action");
    expect(screen.getByTestId("intention-action-hint").textContent).toBe(
      "Choose one small action you can take next.",
    );
    expect(document.body.textContent).not.toContain("I may not be good enough");
    expect(create).not.toHaveBeenCalled();

    await user.type(screen.getByTestId("intention-title"), "Send one short message");
    expect(titleValue()).toBe("Send one short message");
  });

  it("keeps an actionable idea editable instead of locking it in", async () => {
    const user = userEvent.setup();
    openBlankIntention();
    renderIntentions();

    await user.type(screen.getByTestId("intention-title"), "Reply to one email");
    await user.clear(screen.getByTestId("intention-title"));
    await user.type(screen.getByTestId("intention-title"), "Take a ten minute walk");
    expect(titleValue()).toBe("Take a ten minute walk");
    expect(create).not.toHaveBeenCalled();
  });

  it("closes without creating an intention", async () => {
    const user = userEvent.setup();
    openBlankIntention();
    renderIntentions();

    await user.type(screen.getByTestId("intention-title"), "Send one short message");
    await user.click(screen.getByTestId("button-close-intention"));

    expect(screen.queryByTestId("intention-confirmation-form")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("saves only after the user confirms a title and a small action", async () => {
    const user = userEvent.setup();
    openBlankIntention();
    renderIntentions();

    await user.type(screen.getByTestId("intention-title"), "Send one short message");
    expect(create).not.toHaveBeenCalled();
    expect((screen.getByTestId("button-confirm-intention") as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByTestId("intention-small-action"), "Open the draft and send it");
    await user.click(screen.getByTestId("button-confirm-intention"));

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].title).toBe("Send one short message");
  });

  it("shows the helper in Indonesian and Japanese", async () => {
    const user = userEvent.setup();
    openBlankIntention();
    renderIntentions();

    await user.click(screen.getByTestId("switch-language-id"));
    expect(screen.getByTestId("intention-action-hint").textContent).toBe(
      "Pilih satu tindakan kecil yang bisa kamu lakukan berikutnya.",
    );
    expect(screen.getByTestId("intention-title").getAttribute("placeholder")).toBe("Satu tindakan kecil");

    await user.click(screen.getByTestId("switch-language-ja"));
    expect(screen.getByTestId("intention-action-hint").textContent).toBe(
      "次にできる小さな行動を一つ選びましょう。",
    );
    expect(screen.getByTestId("intention-title").getAttribute("placeholder")).toBe("小さな行動を一つ");
  });

  it("leaves the form closed when the Journal did not ask for it", () => {
    renderIntentions();
    expect(screen.queryByTestId("intention-confirmation-form")).toBeNull();
  });

  it("labels the intention list and reminder action in Japanese", async () => {
    const user = userEvent.setup();
    intentionRows.data = [{
      id: "intention-1",
      title: "Send one short message",
      small_action: "Open the draft and send it",
      status: "active",
      reminder_choice: "off",
      reminder_time: null,
      frequency: "once",
    }];
    renderIntentions();
    await user.click(screen.getByTestId("switch-language-ja"));

    expect(screen.getByRole("heading", { name: "進行中の目標" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "新しい目標" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "リマインダーを編集" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "完了" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "延期" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "手放す" })).toBeTruthy();
    expect(screen.getByText("Send one short message")).toBeTruthy();
    expect(document.body.textContent).not.toContain("インテンション");
  });
});
