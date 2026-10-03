/**
 * Journal flow UX regressions:
 *   - progress indicator reflects how far the user has got
 *   - Save Entry explains what is missing instead of dying silently
 *   - a completed entry saves and shows a confirmation state
 *   - unfinished writing survives closing the form
 *   - a saved entry can be reopened and its answers are all readable
 *
 * This project has no jest-dom setup file, so assertions use plain DOM APIs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { JournalEntryForm } from "./JournalEntryForm";
import { JournalEntryDetail } from "./JournalEntryDetail";
import { createJournalEntry, updateJournalEntry } from "@/lib/journal";
import { journalDraftKey } from "@/lib/journalDraft";
import { OPEN_INTENTIONS_EVENT } from "@/lib/intentionSeed";
import type { JournalEntryRow } from "@/lib/journal";

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
  createJournalEntry: vi.fn(async () => ({ id: "entry-1" })),
  updateJournalEntry: vi.fn(async (id: string) => ({ id })),
}));

const DRAFT_KEY = journalDraftKey("test-user");

function renderForm(onSaved = vi.fn()) {
  return render(
    <LanguageProvider>
      <JournalEntryForm onClose={vi.fn()} onSaved={onSaved} />
    </LanguageProvider>,
  );
}

function LanguageSwitch({ code }: { code: "en" | "id" | "ja" }) {
  const { setLanguage } = useLanguage();
  return (
    <button data-testid={`switch-language-${code}`} onClick={() => setLanguage(code)}>
      {code}
    </button>
  );
}

function textOf(testId: string): string {
  return screen.getByTestId(testId).textContent ?? "";
}

function valueOf(testId: string): string {
  return (screen.getByTestId(testId) as HTMLTextAreaElement).value;
}

type User = ReturnType<typeof userEvent.setup>;

/** Fills only what the form requires, leaving optional questions 3-5 blank. */
async function completeRequired(user: User, moodBefore: number, moodAfter: number) {
  await user.type(screen.getByTestId("textarea-situation"), "Missed a deadline");
  await user.type(screen.getByTestId("textarea-trigger"), "I always fail");
  await user.click(screen.getByTestId(`mood-before-${moodBefore}`));
  await user.click(screen.getByTestId(`mood-after-${moodAfter}`));
}

async function saveAndWait(user: User) {
  await user.click(screen.getByTestId("button-save-entry"));
  await waitFor(() => {
    expect(screen.queryByTestId("journal-saved-state")).not.toBeNull();
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("progress indicator", () => {
  it("starts at step 1 of 5 and advances as questions are answered", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(textOf("journal-progress")).toBe("Step 1 of 5");

    await user.type(screen.getByTestId("textarea-situation"), "Missed a deadline");
    expect(textOf("journal-progress")).toBe("Step 2 of 5");

    await user.type(screen.getByTestId("textarea-trigger"), "I always fail");
    expect(textOf("journal-progress")).toBe("Step 3 of 5");
  });

  it("never advances past the final step", async () => {
    const user = userEvent.setup();
    renderForm();

    for (const field of [
      "textarea-situation",
      "textarea-trigger",
      "textarea-evidenceFor",
      "textarea-evidenceAgainst",
      "textarea-reframed",
    ]) {
      await user.type(screen.getByTestId(field), "x");
    }

    expect(textOf("journal-progress")).toBe("Step 5 of 5");
  });
});

describe("required and optional markers", () => {
  it("marks questions 1 and 2 required and questions 3-5 optional", () => {
    renderForm();

    expect(textOf("field-requirement-situation")).toContain("required");
    expect(textOf("field-requirement-trigger")).toContain("required");
    expect(textOf("field-requirement-evidenceFor")).toContain("optional");
    expect(textOf("field-requirement-evidenceAgainst")).toContain("optional");
    expect(textOf("field-requirement-reframed")).toContain("optional");
  });
});

describe("Save Entry validation", () => {
  it("keeps the button clickable rather than silently disabled", () => {
    renderForm();
    const button = screen.getByTestId("button-save-entry") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it("names every missing required field and does not save", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByTestId("button-save-entry"));

    const message = textOf("journal-validation-message");
    expect(message).toContain("What happened?");
    expect(message).toContain("What negative thought came to mind?");
    expect(message).toContain("Mood before");
    expect(message).toContain("Mood after");
    expect(createJournalEntry).not.toHaveBeenCalled();
  });

  it("does not list optional questions 3-5 as missing", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByTestId("button-save-entry"));

    const message = textOf("journal-validation-message");
    expect(message).not.toContain("What makes you think that?");
    expect(message).not.toContain("Is there anything that suggests otherwise?");
    expect(message).not.toContain("Try looking at this in a more balanced way");
  });

  it("clears the message once the missing fields are completed", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByTestId("button-save-entry"));
    expect(screen.queryByTestId("journal-validation-message")).not.toBeNull();

    await user.type(screen.getByTestId("textarea-situation"), "Missed a deadline");
    await user.type(screen.getByTestId("textarea-trigger"), "I always fail");
    await user.click(screen.getByTestId("mood-before-4"));
    await user.click(screen.getByTestId("mood-after-8"));

    await waitFor(() => {
      expect(screen.queryByTestId("journal-validation-message")).toBeNull();
    });
  });
});

describe("saving a completed entry", () => {
  it("submits the answers and shows the completion state", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderForm(onSaved);

    await user.type(screen.getByTestId("textarea-situation"), "Missed a deadline");
    await user.type(screen.getByTestId("textarea-trigger"), "I always fail");
    await user.type(screen.getByTestId("textarea-reframed"), "One deadline is not everything");
    await user.click(screen.getByTestId("mood-before-4"));
    await user.click(screen.getByTestId("mood-after-8"));

    await user.click(screen.getByTestId("button-save-entry"));

    await waitFor(() => {
      expect(screen.queryByTestId("journal-saved-state")).not.toBeNull();
    });

    expect(createJournalEntry).toHaveBeenCalledWith("test-user", {
      taskId: null,
      situation: "Missed a deadline",
      triggerThought: "I always fail",
      evidenceFor: "",
      evidenceAgainst: "",
      reframedThought: "One deadline is not everything",
      moodBefore: 4,
      moodAfter: 8,
    });

    expect(textOf("journal-saved-mood")).toContain("4/10");
    expect(textOf("journal-saved-mood")).toContain("8/10");
    expect(textOf("journal-saved-next")).toContain("Come back tomorrow");

    expect(onSaved).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("button-journal-done"));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("clears the local draft once the entry is saved", async () => {
    const user = userEvent.setup();
    renderForm();

    await completeRequired(user, 4, 8);
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();

    await saveAndWait(user);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

describe("answered-question count", () => {
  it("says all 5 were answered when every question is filled in", async () => {
    const user = userEvent.setup();
    renderForm();

    for (const field of [
      "textarea-situation",
      "textarea-trigger",
      "textarea-evidenceFor",
      "textarea-evidenceAgainst",
      "textarea-reframed",
    ]) {
      await user.type(screen.getByTestId(field), "An answer");
    }
    await user.click(screen.getByTestId("mood-before-6"));
    await user.click(screen.getByTestId("mood-after-8"));

    await saveAndWait(user);

    expect(textOf("journal-saved-answered")).toContain("You answered all 5 questions.");
  });

  it("explains that skipped questions were optional, not missing", async () => {
    const user = userEvent.setup();
    renderForm();

    await completeRequired(user, 6, 8);
    await user.type(screen.getByTestId("textarea-evidenceFor"), "It was late twice");

    await saveAndWait(user);

    const summary = textOf("journal-saved-answered");
    expect(summary).toContain("3 of 5");
    expect(summary).toContain("optional");
    expect(summary).toContain("complete");
  });

  it("counts only non-empty answers and ignores whitespace-only ones", async () => {
    const user = userEvent.setup();
    renderForm();

    await completeRequired(user, 6, 8);
    await user.type(screen.getByTestId("textarea-evidenceFor"), "   ");

    await saveAndWait(user);

    expect(textOf("journal-saved-answered")).toContain("2 of 5");
  });
});

describe("mood score direction", () => {
  // MOODS runs 2 (Awful) to 10 (Great): a higher score is a better mood.
  it("treats a higher score after writing as possibly feeling better", async () => {
    const user = userEvent.setup();
    renderForm();
    await completeRequired(user, 4, 8);
    await saveAndWait(user);

    expect(textOf("journal-saved-mood-message")).toBe(
      "You may be feeling a little better after reflecting.",
    );
  });

  it("uses a neutral message when the score is unchanged", async () => {
    const user = userEvent.setup();
    renderForm();
    await completeRequired(user, 6, 6);
    await saveAndWait(user);

    expect(textOf("journal-saved-mood-message")).toBe(
      "It is okay if your feelings have not changed yet.",
    );
  });

  it("never claims improvement when the score went down", async () => {
    const user = userEvent.setup();
    renderForm();
    await completeRequired(user, 8, 4);
    await saveAndWait(user);

    const message = textOf("journal-saved-mood-message");
    expect(message).toBe("It may still feel difficult. Try taking one small step.");
    expect(message.toLowerCase()).not.toContain("better");
  });
});

describe("preserving unfinished answers", () => {
  it("restores what the user wrote after the form is closed and reopened", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByTestId("textarea-situation"), "Missed a deadline");
    await user.type(screen.getByTestId("textarea-evidenceFor"), "It was late twice");
    await user.click(screen.getByTestId("mood-before-6"));

    cleanup();
    renderForm();

    expect(valueOf("textarea-situation")).toBe("Missed a deadline");
    expect(valueOf("textarea-evidenceFor")).toBe("It was late twice");
    expect(screen.getByTestId("mood-before-6").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByTestId("journal-draft-notice")).not.toBeNull();
  });

  it("warns that starting fresh deletes the draft before doing it", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByTestId("textarea-situation"), "Missed a deadline");

    cleanup();
    renderForm();
    await user.click(screen.getByTestId("button-discard-draft"));

    const warning = textOf("journal-draft-warning");
    expect(warning).toContain("delete");
    expect(warning).toContain("cannot be undone");
    expect(valueOf("textarea-situation")).toBe("Missed a deadline");
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it("keeps the draft when the user backs out of starting fresh", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByTestId("textarea-situation"), "Missed a deadline");

    cleanup();
    renderForm();
    await user.click(screen.getByTestId("button-discard-draft"));
    await user.click(screen.getByTestId("button-cancel-discard-draft"));

    expect(screen.queryByTestId("journal-draft-warning")).toBeNull();
    expect(valueOf("textarea-situation")).toBe("Missed a deadline");
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it("clears the draft once starting fresh is confirmed", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByTestId("textarea-situation"), "Missed a deadline");

    cleanup();
    renderForm();
    await user.click(screen.getByTestId("button-discard-draft"));
    await user.click(screen.getByTestId("button-confirm-discard-draft"));

    expect(valueOf("textarea-situation")).toBe("");
    await waitFor(() => {
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });
  });

  it("keeps drafts scoped to the signed-in user", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByTestId("textarea-situation"), "Missed a deadline");

    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(DRAFT_KEY).toContain("test-user");
    expect(journalDraftKey("other-user")).not.toBe(DRAFT_KEY);
    expect(localStorage.getItem(journalDraftKey("other-user"))).toBeNull();
  });

  it("does not store a draft when nothing has been written", () => {
    renderForm();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(screen.queryByTestId("journal-draft-notice")).toBeNull();
  });
});

describe("reopening a saved entry", () => {
  const entry: JournalEntryRow = {
    id: "entry-1",
    user_id: "test-user",
    task_id: null,
    situation: "Missed a deadline",
    trigger_thought: "I always fail",
    evidence_for: "It was late twice",
    evidence_against: "I delivered the last four on time",
    reframed_thought: "One deadline is not everything",
    mood_before: 4,
    mood_after: 8,
    tags: null,
    created_at: "2026-09-20T10:00:00.000Z",
  };

  it("shows every stored answer without altering it", () => {
    render(
      <LanguageProvider>
        <JournalEntryDetail entry={entry} onClose={vi.fn()} onEdit={vi.fn()} />
      </LanguageProvider>,
    );

    expect(textOf("journal-detail-field-1")).toBe("Missed a deadline");
    expect(textOf("journal-detail-field-2")).toBe("I always fail");
    expect(textOf("journal-detail-field-3")).toBe("It was late twice");
    expect(textOf("journal-detail-field-4")).toBe("I delivered the last four on time");
    expect(textOf("journal-detail-field-5")).toBe("One deadline is not everything");
    expect(textOf("journal-detail-mood")).toContain("4");
    expect(textOf("journal-detail-mood")).toContain("8");
  });

  it("marks skipped optional questions instead of leaving them blank", () => {
    render(
      <LanguageProvider>
        <JournalEntryDetail
          entry={{ ...entry, evidence_for: null, evidence_against: "" }}
          onClose={vi.fn()}
          onEdit={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(textOf("journal-detail-field-3")).toBe("Not answered");
    expect(textOf("journal-detail-field-4")).toBe("Not answered");
  });

  it("summarises a saved entry with the mood direction and the user's own words", () => {
    render(
      <LanguageProvider>
        <JournalEntryDetail entry={entry} onClose={vi.fn()} onEdit={vi.fn()} />
      </LanguageProvider>,
    );

    expect(textOf("journal-reflection-title")).toBe("Reflection summary");
    expect(textOf("journal-reflection-saved")).toBe("This entry is saved.");
    expect(textOf("journal-reflection-mood")).toContain("4/10");
    expect(textOf("journal-reflection-mood")).toContain("8/10");
    expect(textOf("journal-reflection-mood")).toContain("Up 4 points");
    expect(textOf("journal-reflection-mood")).not.toContain("-");
    expect(textOf("journal-reflection-message")).toBe(
      "You may be feeling a little better after reflecting.",
    );
    expect(textOf("journal-reflection-perspective")).toBe("One deadline is not everything");
  });

  it("uses a neutral message when the mood did not move", () => {
    render(
      <LanguageProvider>
        <JournalEntryDetail
          entry={{ ...entry, mood_before: 6, mood_after: 6 }}
          onClose={vi.fn()}
          onEdit={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(textOf("journal-reflection-mood")).toContain("No change");
    expect(textOf("journal-reflection-message")).toBe(
      "It is okay if your feelings have not changed yet.",
    );
  });

  it("does not call a lower mood an improvement", () => {
    render(
      <LanguageProvider>
        <JournalEntryDetail
          entry={{ ...entry, mood_before: 8, mood_after: 4 }}
          onClose={vi.fn()}
          onEdit={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(textOf("journal-reflection-mood")).toContain("Down 4 points");
    expect(textOf("journal-reflection-mood")).not.toContain("-4");
    expect(textOf("journal-reflection-message")).toBe(
      "It may still feel difficult. Try taking one small step.",
    );
  });

  it("skips a numeric mood result when a score is missing", () => {
    render(
      <LanguageProvider>
        <JournalEntryDetail
          entry={{ ...entry, mood_before: null, mood_after: null }}
          onClose={vi.fn()}
          onEdit={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(textOf("journal-reflection-mood")).toBe("Mood was not recorded for this entry.");
    expect(screen.queryByTestId("journal-reflection-message")).toBeNull();
    expect(textOf("journal-reflection")).not.toMatch(/\d\/10/);
  });

  it("does not invent a perspective when question 5 is empty", () => {
    render(
      <LanguageProvider>
        <JournalEntryDetail
          entry={{ ...entry, reframed_thought: "  " }}
          onClose={vi.fn()}
          onEdit={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(screen.queryByTestId("journal-reflection-perspective")).toBeNull();
    expect(textOf("journal-reflection-perspective-label")).toContain("add a calmer way of seeing this later");
  });

  it("keeps the written perspective verbatim when the language changes", async () => {
    const user = userEvent.setup();
    const written = "Saya merasa gagal setelah rapat tadi";
    render(
      <LanguageProvider>
        <LanguageSwitch code="id" />
        <LanguageSwitch code="ja" />
        <JournalEntryDetail
          entry={{ ...entry, reframed_thought: written }}
          onClose={vi.fn()}
          onEdit={vi.fn()}
        />
      </LanguageProvider>,
    );

    await user.click(screen.getByTestId("switch-language-id"));
    expect(textOf("journal-reflection-title")).toBe("Ringkasan refleksi");
    expect(textOf("button-create-intention")).toBe("Buat Niat");
    expect(textOf("journal-reflection-perspective")).toBe(written);

    await user.click(screen.getByTestId("switch-language-ja"));
    expect(textOf("journal-reflection-title")).toBe("振り返りのまとめ");
    expect(textOf("button-create-intention")).toBe("目標を作る");
    expect(textOf("journal-reflection-perspective")).toBe(written);
  });

  it("opens a blank intention form and does not copy the written perspective", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const opened = vi.fn();
    window.addEventListener(OPEN_INTENTIONS_EVENT, opened);
    sessionStorage.clear();

    render(
      <LanguageProvider>
        <JournalEntryDetail entry={entry} onClose={vi.fn()} onEdit={vi.fn()} />
      </LanguageProvider>,
    );

    expect(textOf("journal-reflection-perspective")).toBe("One deadline is not everything");
    await user.click(screen.getByTestId("button-create-intention"));

    expect(sessionStorage.getItem("intention_open_blank")).toBe("1");
    expect(sessionStorage.getItem("intention_seed_title")).toBeNull();
    expect(JSON.stringify(sessionStorage)).not.toContain("One deadline is not everything");
    expect(opened).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createJournalEntry).not.toHaveBeenCalled();
    expect(updateJournalEntry).not.toHaveBeenCalled();

    window.removeEventListener(OPEN_INTENTIONS_EVENT, opened);
    fetchSpy.mockRestore();
    sessionStorage.clear();
  });

  it("offers a way into editing", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <LanguageProvider>
        <JournalEntryDetail entry={entry} onClose={vi.fn()} onEdit={onEdit} />
      </LanguageProvider>,
    );

    expect(textOf("button-edit-entry")).toContain("Edit");
    await user.click(screen.getByTestId("button-edit-entry"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe("editing a saved entry", () => {
  const SAVED: JournalEntryRow = {
    id: "entry-1",
    user_id: "test-user",
    task_id: null,
    situation: "Missed a deadline",
    trigger_thought: "I always fail",
    evidence_for: "It was late twice",
    evidence_against: "I delivered the last four on time",
    reframed_thought: "One deadline is not everything",
    mood_before: 4,
    mood_after: 8,
    tags: null,
    created_at: "2026-09-20T10:00:00.000Z",
  };

  const EDIT_KEY = journalDraftKey("test-user", SAVED.id);

  /** The saved entry as draft values, with one answer part-way through a rewrite. */
  const UNSAVED_EDIT = JSON.stringify({
    taskId: "",
    situation: "A half-written revision",
    trigger: "I always fail",
    evidenceFor: "It was late twice",
    evidenceAgainst: "I delivered the last four on time",
    reframed: "One deadline is not everything",
    moodBefore: 4,
    moodAfter: 8,
  });

  function renderEdit(onSaved = vi.fn(), onClose = vi.fn()) {
    return render(
      <LanguageProvider>
        <JournalEntryForm entry={SAVED} onClose={onClose} onSaved={onSaved} />
      </LanguageProvider>,
    );
  }

  it("pre-fills every saved answer and both mood values", () => {
    renderEdit();

    expect(valueOf("textarea-situation")).toBe("Missed a deadline");
    expect(valueOf("textarea-trigger")).toBe("I always fail");
    expect(valueOf("textarea-evidenceFor")).toBe("It was late twice");
    expect(valueOf("textarea-evidenceAgainst")).toBe("I delivered the last four on time");
    expect(valueOf("textarea-reframed")).toBe("One deadline is not everything");
    expect(screen.getByTestId("mood-before-4").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("mood-after-8").getAttribute("aria-pressed")).toBe("true");
  });

  it("presents itself as an edit rather than a new entry", () => {
    renderEdit();

    expect(textOf("journal-form-title")).toBe("Edit Entry");
    expect(textOf("button-save-entry")).toBe("Save Changes");
  });

  it("updates the existing row instead of creating a duplicate", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.clear(screen.getByTestId("textarea-reframed"));
    await user.type(screen.getByTestId("textarea-reframed"), "One deadline is one deadline");
    await saveAndWait(user);

    expect(createJournalEntry).not.toHaveBeenCalled();
    expect(updateJournalEntry).toHaveBeenCalledTimes(1);

    const [entryId, input] = vi.mocked(updateJournalEntry).mock.calls[0];
    expect(entryId).toBe("entry-1");
    expect(input.reframedThought).toBe("One deadline is one deadline");
    // Untouched answers go back exactly as they were stored.
    expect(input.situation).toBe("Missed a deadline");
    expect(input.triggerThought).toBe("I always fail");
  });

  it("never sends id, created_at or user_id in the update payload", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.type(screen.getByTestId("textarea-situation"), " again");
    await saveAndWait(user);

    const [, input] = vi.mocked(updateJournalEntry).mock.calls[0];
    expect(Object.keys(input).sort()).toEqual([
      "evidenceAgainst",
      "evidenceFor",
      "moodAfter",
      "moodBefore",
      "reframedThought",
      "situation",
      "taskId",
      "triggerThought",
    ]);
  });

  it("hands the refreshed row back so the caller keeps id and created_at", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    vi.mocked(updateJournalEntry).mockResolvedValueOnce({
      ...SAVED,
      situation: "Missed a deadline again",
    });
    renderEdit(onSaved);

    await user.type(screen.getByTestId("textarea-situation"), " again");
    await saveAndWait(user);
    await user.click(screen.getByTestId("button-journal-done"));

    const returned = onSaved.mock.calls[0][0] as JournalEntryRow;
    expect(returned.id).toBe(SAVED.id);
    expect(returned.created_at).toBe(SAVED.created_at);
    expect(returned.situation).toBe("Missed a deadline again");
  });

  it("confirms the save as a change rather than a brand new entry", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.type(screen.getByTestId("textarea-situation"), " again");
    await saveAndWait(user);

    expect(textOf("journal-saved-title")).toBe("Changes saved");
  });

  it("leaves the saved entry alone when the user backs out", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderEdit(vi.fn(), onClose);

    await user.click(screen.getByTestId("button-journal-back"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(updateJournalEntry).not.toHaveBeenCalled();
    expect(createJournalEntry).not.toHaveBeenCalled();
  });

  it("still enforces the required questions after they are emptied", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.clear(screen.getByTestId("textarea-situation"));
    await user.click(screen.getByTestId("button-save-entry"));

    expect(screen.queryByTestId("journal-validation-message")).not.toBeNull();
    expect(textOf("journal-validation-message")).toContain("What happened?");
    expect(updateJournalEntry).not.toHaveBeenCalled();
  });

  it("reflects a mood that dropped since the entry was written", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.click(screen.getByTestId("mood-after-2"));
    await saveAndWait(user);

    const [, input] = vi.mocked(updateJournalEntry).mock.calls[0];
    expect(input.moodBefore).toBe(4);
    expect(input.moodAfter).toBe(2);
    expect(textOf("journal-saved-mood")).toBe("Mood 4/10 → 2/10");
    expect(textOf("journal-saved-mood-message")).toBe(
      "It may still feel difficult. Try taking one small step.",
    );
  });

  describe("drafts", () => {
    it("writes edits under a key scoped to the user and the entry", async () => {
      const user = userEvent.setup();
      renderEdit();

      await user.type(screen.getByTestId("textarea-situation"), " again");

      expect(EDIT_KEY).toBe("journal_draft_test-user_entry-1");
      expect(localStorage.getItem(EDIT_KEY)).not.toBeNull();
    });

    it("does not disturb the new-entry draft or another entry's draft", async () => {
      const user = userEvent.setup();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ situation: "unrelated new entry" }));
      localStorage.setItem(
        journalDraftKey("test-user", "entry-2"),
        JSON.stringify({ situation: "unrelated other edit" }),
      );
      renderEdit();

      await user.type(screen.getByTestId("textarea-situation"), " again");

      expect(localStorage.getItem(DRAFT_KEY)).toContain("unrelated new entry");
      expect(localStorage.getItem(journalDraftKey("test-user", "entry-2"))).toContain(
        "unrelated other edit",
      );
    });

    it("restores unsaved edits when the form is reopened", async () => {
      localStorage.setItem(EDIT_KEY, UNSAVED_EDIT);
      renderEdit();

      expect(valueOf("textarea-situation")).toBe("A half-written revision");
      expect(textOf("journal-draft-notice")).toContain("We kept the changes you had not saved yet.");
    });

    it("asks before throwing away unsaved edits, then restores the saved text", async () => {
      const user = userEvent.setup();
      localStorage.setItem(EDIT_KEY, UNSAVED_EDIT);
      renderEdit();

      await user.click(screen.getByTestId("button-discard-draft"));
      expect(textOf("journal-draft-warning")).toContain(
        "bring back your saved entry",
      );
      expect(valueOf("textarea-situation")).toBe("A half-written revision");

      await user.click(screen.getByTestId("button-confirm-discard-draft"));
      // Reverting restores what is stored, never an empty form.
      expect(valueOf("textarea-situation")).toBe("Missed a deadline");
      expect(valueOf("textarea-trigger")).toBe("I always fail");
      expect(localStorage.getItem(EDIT_KEY)).toBeNull();
    });

    it("clears only this entry's draft once the change is saved", async () => {
      const user = userEvent.setup();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ situation: "unrelated new entry" }));
      renderEdit();

      await user.type(screen.getByTestId("textarea-situation"), " again");
      await saveAndWait(user);

      expect(localStorage.getItem(EDIT_KEY)).toBeNull();
      expect(localStorage.getItem(DRAFT_KEY)).toContain("unrelated new entry");
    });
  });

  describe("localization", () => {
    function renderEditIn(code: "en" | "id" | "ja") {
      return render(
        <LanguageProvider>
          <LanguageSwitch code={code} />
          <JournalEntryForm entry={SAVED} onClose={vi.fn()} onSaved={vi.fn()} />
        </LanguageProvider>,
      );
    }

    it("labels the edit screen in Indonesian", async () => {
      const user = userEvent.setup();
      renderEditIn("id");
      await user.click(screen.getByTestId("switch-language-id"));

      expect(textOf("journal-form-title")).toBe("Ubah Entri");
      expect(textOf("button-save-entry")).toBe("Simpan Perubahan");
    });

    it("labels the edit screen in Japanese", async () => {
      const user = userEvent.setup();
      renderEditIn("ja");
      await user.click(screen.getByTestId("switch-language-ja"));

      expect(textOf("journal-form-title")).toBe("記録を編集");
      expect(textOf("button-save-entry")).toBe("変更を保存");
    });

    it("labels the Edit action on the detail view in all three languages", async () => {
      const user = userEvent.setup();
      render(
        <LanguageProvider>
          <LanguageSwitch code="id" />
          <LanguageSwitch code="ja" />
          <JournalEntryDetail entry={SAVED} onClose={vi.fn()} onEdit={vi.fn()} />
        </LanguageProvider>,
      );

      expect(textOf("button-edit-entry")).toContain("Edit");

      await user.click(screen.getByTestId("switch-language-id"));
      expect(textOf("button-edit-entry")).toContain("Ubah");

      await user.click(screen.getByTestId("switch-language-ja"));
      expect(textOf("button-edit-entry")).toContain("編集");
    });
  });
});
