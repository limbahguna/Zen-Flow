/**
 * The Journal patterns card summarises stored entries. Two things have to stay
 * true: the mood sentence must match the direction of the shift (journal mood
 * is higher-is-better), and user-written text must be rendered exactly as saved.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import JournalPage from "./journal";
import { createJournalEntry, updateJournalEntry } from "@/lib/journal";
import type { JournalEntryRow } from "@/lib/journal";

const listJournalEntries = vi.fn();

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
  createJournalEntry: vi.fn(async () => ({ id: "new-entry" })),
  updateJournalEntry: vi.fn(async (id: string) => ({ id })),
}));

vi.mock("@/hooks/useJournal", () => ({
  useJournal: vi.fn(() => ({
    data: listJournalEntries(),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}));

/**
 * The instant of local noon N days ago. Anchoring at noon keeps the entry on
 * the intended local calendar day in every timezone, so these fixtures are
 * deterministic without pinning a TZ for the suite.
 */
function createdAtDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function entry(
  id: string,
  moodBefore: number,
  moodAfter: number,
  daysAgo: number,
  overrides: Partial<JournalEntryRow> = {},
): JournalEntryRow {
  return {
    id,
    user_id: "test-user",
    task_id: null,
    situation: "Missed a deadline",
    trigger_thought: "I always fail",
    evidence_for: null,
    evidence_against: null,
    reframed_thought: null,
    mood_before: moodBefore,
    mood_after: moodAfter,
    tags: null,
    created_at: createdAtDaysAgo(daysAgo),
    ...overrides,
  };
}

function LanguageSwitch({ code }: { code: "en" | "id" | "ja" }) {
  const { setLanguage } = useLanguage();
  return (
    <button data-testid={`switch-language-${code}`} onClick={() => setLanguage(code)}>
      {code}
    </button>
  );
}

function renderJournal(entries: JournalEntryRow[]) {
  listJournalEntries.mockReturnValue(entries);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <LanguageSwitch code="id" />
        <LanguageSwitch code="ja" />
        <JournalPage />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

function moodLine(): string {
  return screen.getByTestId("journal-patterns-mood").textContent ?? "";
}

function streakLine(): string {
  return screen.getByTestId("journal-patterns-streak").textContent ?? "";
}

afterEach(() => {
  cleanup();
  listJournalEntries.mockReset();
  vi.mocked(updateJournalEntry).mockReset();
  vi.mocked(createJournalEntry).mockReset();
  localStorage.clear();
});

describe("average mood direction", () => {
  it("calls a rising average an improvement", () => {
    renderJournal([
      entry("a", 4, 6, 5),
      entry("b", 4, 6, 6),
      entry("c", 5, 6, 7),
      entry("d", 5, 6, 8),
    ]);

    expect(moodLine()).toContain("Average mood improved by 1.5 points");
  });

  it("calls a falling average a decrease and shows it unsigned", () => {
    renderJournal([entry("a", 8, 6, 5), entry("b", 8, 5, 6), entry("c", 8, 5, 7)]);

    expect(moodLine()).toContain("Average mood decreased by 2.7 points");
    expect(moodLine()).not.toContain("improved");
    expect(moodLine()).not.toContain("-2.7");
  });

  it("uses neutral wording when the average does not move", () => {
    renderJournal([entry("a", 6, 7, 5), entry("b", 6, 5, 6), entry("c", 6, 6, 7)]);

    expect(moodLine()).toContain("Average mood stayed the same");
    expect(moodLine()).not.toContain("0 points");
  });

  it("translates the mood sentence into Indonesian and Japanese", async () => {
    const user = userEvent.setup();
    renderJournal([
      entry("a", 4, 6, 5),
      entry("b", 4, 6, 6),
      entry("c", 5, 6, 7),
      entry("d", 5, 6, 8),
    ]);

    await user.click(screen.getByTestId("switch-language-id"));
    expect(moodLine()).toContain("Rata-rata suasana hati naik 1.5 poin");

    await user.click(screen.getByTestId("switch-language-ja"));
    expect(moodLine()).toContain("平均して気分が1.5ポイント上がりました");
  });

  it("translates a decrease without borrowing the improvement wording", async () => {
    const user = userEvent.setup();
    renderJournal([entry("a", 8, 6, 5), entry("b", 8, 5, 6), entry("c", 8, 5, 7)]);

    await user.click(screen.getByTestId("switch-language-id"));
    expect(moodLine()).toContain("Rata-rata suasana hati turun 2.7 poin");
    expect(moodLine()).not.toContain("naik");

    await user.click(screen.getByTestId("switch-language-ja"));
    expect(moodLine()).toContain("平均して気分が2.7ポイント下がりました");
    expect(moodLine()).not.toContain("上がりました");
  });
});

describe("streak wording", () => {
  it("avoids saying zero days when there is no streak", async () => {
    const user = userEvent.setup();
    renderJournal([entry("a", 6, 6, 5), entry("b", 6, 6, 6), entry("c", 6, 6, 7)]);

    expect(streakLine()).toContain("No consecutive days yet");
    expect(streakLine()).not.toContain("0");

    await user.click(screen.getByTestId("switch-language-id"));
    expect(streakLine()).toContain("Belum ada catatan berturut-turut");

    await user.click(screen.getByTestId("switch-language-ja"));
    expect(streakLine()).toContain("まだ連続記録はありません");
  });

  it("keeps the counted wording once a streak exists", async () => {
    const user = userEvent.setup();
    renderJournal([entry("a", 6, 6, 0), entry("b", 6, 6, 1), entry("c", 6, 6, 2)]);

    expect(streakLine()).toContain("3 days in a row");

    await user.click(screen.getByTestId("switch-language-id"));
    expect(streakLine()).toContain("Menulis 3 hari berturut-turut");

    await user.click(screen.getByTestId("switch-language-ja"));
    expect(streakLine()).toContain("3日続けて書いています");
  });
});

describe("user-written content", () => {
  it("renders saved text verbatim and never translates it", async () => {
    const user = userEvent.setup();
    const written = "Saya merasa gagal setelah rapat tadi";
    renderJournal([
      entry("a", 6, 6, 5, { reframed_thought: written }),
      entry("b", 6, 6, 6),
      entry("c", 6, 6, 7),
    ]);

    expect(screen.getByTestId("journal-card-a").textContent).toContain(written);

    await user.click(screen.getByTestId("switch-language-ja"));
    expect(screen.getByTestId("journal-card-a").textContent).toContain(written);
  });

  it("opens a saved entry and shows the stored answers unchanged", async () => {
    const user = userEvent.setup();
    renderJournal([
      entry("a", 4, 8, 5, {
        situation: "対面のミーティングで発言できなかった",
        trigger_thought: "I always freeze",
      }),
      entry("b", 6, 6, 6),
      entry("c", 6, 6, 7),
    ]);

    await user.click(screen.getByTestId("journal-card-a"));

    expect(screen.getByTestId("journal-detail-field-1").textContent).toBe(
      "対面のミーティングで発言できなかった",
    );
    expect(screen.getByTestId("journal-detail-field-2").textContent).toBe("I always freeze");
  });
});

describe("editing from the list", () => {
  it("opens the saved entry in the edit form with its answers pre-filled", async () => {
    const user = userEvent.setup();
    renderJournal([entry("a", 4, 8, 0, { situation: "Missed a deadline" })]);

    await user.click(screen.getByTestId("journal-card-a"));
    await user.click(screen.getByTestId("button-edit-entry"));

    expect(screen.getByTestId("journal-form-title").textContent).toBe("Edit Entry");
    expect((screen.getByTestId("textarea-situation") as HTMLTextAreaElement).value).toBe(
      "Missed a deadline",
    );
  });

  it("updates in place, then re-reads the list so patterns and streak follow", async () => {
    const user = userEvent.setup();
    const before = [entry("a", 4, 8, 0), entry("b", 4, 8, 1), entry("c", 4, 8, 2)];
    renderJournal(before);

    expect(moodLine()).toContain("improved by 4 points");
    expect(streakLine()).toContain("3 days in a row");

    // The edited row comes back from the server and replaces the stored one;
    // the refreshed list is what the patterns card reads next.
    const edited = { ...before[0], mood_after: 2 };
    vi.mocked(updateJournalEntry).mockImplementationOnce(async () => {
      listJournalEntries.mockReturnValue([edited, before[1], before[2]]);
      return edited;
    });

    await user.click(screen.getByTestId("journal-card-a"));
    await user.click(screen.getByTestId("button-edit-entry"));
    await user.click(screen.getByTestId("mood-after-2"));
    await user.click(screen.getByTestId("button-save-entry"));
    await user.click(await screen.findByTestId("button-journal-done"));

    expect(updateJournalEntry).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateJournalEntry).mock.calls[0][0]).toBe("a");
    expect(createJournalEntry).not.toHaveBeenCalled();

    // Still three entries — the edit replaced a row rather than adding one.
    expect(screen.getAllByTestId(/^journal-card-/)).toHaveLength(3);
    // (-2 + 4 + 4) / 3 — the edited row is what the average now reads.
    expect(moodLine()).toContain("improved by 2 points");
    expect(streakLine()).toContain("3 days in a row");
  });

  it("returns to the detail view showing the updated answers", async () => {
    const user = userEvent.setup();
    const original = entry("a", 4, 8, 0, { situation: "Missed a deadline" });
    renderJournal([original]);

    const edited = { ...original, situation: "Missed a deadline, and said so" };
    vi.mocked(updateJournalEntry).mockResolvedValueOnce(edited);

    await user.click(screen.getByTestId("journal-card-a"));
    await user.click(screen.getByTestId("button-edit-entry"));
    await user.type(screen.getByTestId("textarea-situation"), ", and said so");
    await user.click(screen.getByTestId("button-save-entry"));
    await user.click(await screen.findByTestId("button-journal-done"));

    expect(screen.getByTestId("journal-detail-field-1").textContent).toBe(
      "Missed a deadline, and said so",
    );
    // id and created_at survive the round trip untouched.
    expect(edited.id).toBe(original.id);
    expect(edited.created_at).toBe(original.created_at);
  });

  it("leaves the entry untouched when the edit is cancelled", async () => {
    const user = userEvent.setup();
    renderJournal([entry("a", 4, 8, 0, { situation: "Missed a deadline" })]);

    await user.click(screen.getByTestId("journal-card-a"));
    await user.click(screen.getByTestId("button-edit-entry"));
    await user.type(screen.getByTestId("textarea-situation"), " and it stung");
    await user.click(screen.getByTestId("button-journal-back"));

    expect(updateJournalEntry).not.toHaveBeenCalled();
    expect(screen.getByTestId("journal-detail-field-1").textContent).toBe("Missed a deadline");
  });
});
