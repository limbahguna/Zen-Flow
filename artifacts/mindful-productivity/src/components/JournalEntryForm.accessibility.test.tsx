import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { JournalEntryForm } from "./JournalEntryForm";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "test-user" } })),
}));

vi.mock("@/hooks/useTasks", () => ({
  useTasks: vi.fn(() => ({ data: [] })),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock("@/lib/journal", () => ({
  createJournalEntry: vi.fn(),
}));

function LanguageSwitch({ code }: { code: "en" | "id" | "ja" }) {
  const { setLanguage } = useLanguage();
  return (
    <button data-testid={`switch-language-${code}`} onClick={() => setLanguage(code)}>
      {code}
    </button>
  );
}

describe("JournalEntryForm mood accessibility labels", () => {
  afterEach(() => {
    cleanup();
    localStorage.removeItem("mindful_language");
  });

  it("updates all mood control names for EN, Indonesian, and Japanese", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <LanguageSwitch code="id" />
        <LanguageSwitch code="ja" />
        <JournalEntryForm onClose={vi.fn()} onSaved={vi.fn()} />
      </LanguageProvider>,
    );

    const labels = (prefix: string) =>
      [2, 4, 6, 8, 10].map((value) =>
        screen.getByTestId(`mood-before-${value}`).getAttribute("aria-label"),
      );

    expect(labels("en")).toEqual(["Awful", "Low", "Okay", "Good", "Great"]);

    await user.click(screen.getByTestId("switch-language-id"));
    expect(labels("id")).toEqual(["Sangat buruk", "Rendah", "Biasa saja", "Baik", "Sangat baik"]);

    await user.click(screen.getByTestId("switch-language-ja"));
    expect(labels("ja")).toEqual(["とても悪い", "低い", "普通", "良い", "最高"]);
  });
});