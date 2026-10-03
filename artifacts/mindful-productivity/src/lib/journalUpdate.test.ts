/**
 * Ownership rules for updating a saved journal entry.
 *
 * journal_entries is reached directly from the browser with the Supabase anon
 * key, so RLS (auth.uid() = user_id) is the real authority. These tests pin the
 * client-side half of that contract: the owner comes from the live session, the
 * query is filtered to that owner, and nothing that could reassign ownership or
 * rewrite history is ever sent.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedUpdate {
  table: string;
  payload: Record<string, unknown>;
  filters: Array<[string, unknown]>;
}

const state: {
  captured: CapturedUpdate | null;
  sessionUserId: string | null;
  authError: Error | null;
  result: { data: unknown; error: unknown };
} = {
  captured: null,
  sessionUserId: "owner-user",
  authError: null,
  result: { data: null, error: null },
};

vi.mock("./supabase", () => ({
  default: {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: state.sessionUserId ? { id: state.sessionUserId } : null },
        error: state.authError,
      })),
    },
    from: vi.fn((table: string) => ({
      update: vi.fn((payload: Record<string, unknown>) => {
        const captured: CapturedUpdate = { table, payload, filters: [] };
        state.captured = captured;
        const chain = {
          eq: vi.fn((column: string, value: unknown) => {
            captured.filters.push([column, value]);
            return chain;
          }),
          select: vi.fn(() => chain),
          single: vi.fn(async () => state.result),
        };
        return chain;
      }),
    })),
  },
}));

const { updateJournalEntry } = await import("./journal");

const INPUT = {
  taskId: null,
  situation: "  Missed a deadline  ",
  triggerThought: "I always fail",
  evidenceFor: "",
  evidenceAgainst: "I delivered the last four on time",
  reframedThought: "One deadline is not everything",
  moodBefore: 4,
  moodAfter: 8,
};

const STORED_ROW = {
  id: "entry-1",
  user_id: "owner-user",
  created_at: "2026-09-20T10:00:00.000Z",
};

beforeEach(() => {
  state.captured = null;
  state.sessionUserId = "owner-user";
  state.authError = null;
  state.result = { data: STORED_ROW, error: null };
  vi.clearAllMocks();
});

describe("updateJournalEntry ownership", () => {
  it("scopes the update to the entry and the signed-in user", async () => {
    await updateJournalEntry("entry-1", INPUT);

    expect(state.captured?.table).toBe("journal_entries");
    expect(state.captured?.filters).toEqual([
      ["id", "entry-1"],
      ["user_id", "owner-user"],
    ]);
  });

  it("follows whoever is signed in, not anything the caller passes", async () => {
    // The signature accepts an entry id and content only, so the owner filter
    // can only ever come from the session.
    state.sessionUserId = "a-different-user";

    await updateJournalEntry("entry-1", INPUT);

    expect(state.captured?.filters).toContainEqual(["user_id", "a-different-user"]);
  });

  it("refuses to write when nobody is signed in", async () => {
    state.sessionUserId = null;

    await expect(updateJournalEntry("entry-1", INPUT)).rejects.toThrow("Not signed in");
    expect(state.captured).toBeNull();
  });

  it("refuses to write when the session cannot be read", async () => {
    state.authError = new Error("session expired");

    await expect(updateJournalEntry("entry-1", INPUT)).rejects.toThrow("session expired");
    expect(state.captured).toBeNull();
  });

  it("fails closed when the row belongs to someone else", async () => {
    // RLS hides the row, so the filtered update matches nothing and .single()
    // reports the error rather than silently succeeding.
    state.result = { data: null, error: new Error("No rows found") };

    await expect(updateJournalEntry("someone-elses-entry", INPUT)).rejects.toThrow(
      "No rows found",
    );
  });

  it("never writes user_id, id or created_at", async () => {
    await updateJournalEntry("entry-1", INPUT);

    const payload = state.captured?.payload ?? {};
    expect(payload).not.toHaveProperty("user_id");
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("created_at");
  });

  it("applies the same normalisation as creating an entry", async () => {
    await updateJournalEntry("entry-1", INPUT);

    expect(state.captured?.payload).toEqual({
      task_id: null,
      situation: "Missed a deadline",
      trigger_thought: "I always fail",
      evidence_for: null,
      evidence_against: "I delivered the last four on time",
      reframed_thought: "One deadline is not everything",
      mood_before: 4,
      mood_after: 8,
    });
  });

  it("returns the stored row, keeping its id and created_at", async () => {
    const row = await updateJournalEntry("entry-1", INPUT);

    expect(row.id).toBe("entry-1");
    expect(row.created_at).toBe("2026-09-20T10:00:00.000Z");
  });
});
