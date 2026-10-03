/**
 * Local-only draft storage for an unfinished journal entry.
 *
 * Lives entirely in localStorage — no database column, no API call. A draft is
 * scoped per user id so two accounts on one device never see each other's text.
 */

export interface JournalDraft {
  taskId: string;
  situation: string;
  trigger: string;
  evidenceFor: string;
  evidenceAgainst: string;
  reframed: string;
  moodBefore: number | null;
  moodAfter: number | null;
}

const PREFIX = "journal_draft_";

/**
 * Drafts are scoped by user and, when editing, by entry id — so starting an
 * edit never overwrites the new-entry draft or another entry's edit draft.
 * The key for a new entry is unchanged, keeping existing drafts readable.
 */
export function journalDraftKey(userId?: string | null, entryId?: string | null): string {
  const owner = `${PREFIX}${userId || "anonymous"}`;
  return entryId ? `${owner}_${entryId}` : owner;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function mood(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** True when the draft holds anything worth restoring. */
export function isDraftEmpty(draft: JournalDraft): boolean {
  return (
    draft.taskId.trim() === "" &&
    draft.situation.trim() === "" &&
    draft.trigger.trim() === "" &&
    draft.evidenceFor.trim() === "" &&
    draft.evidenceAgainst.trim() === "" &&
    draft.reframed.trim() === "" &&
    draft.moodBefore == null &&
    draft.moodAfter == null
  );
}

export function loadJournalDraft(
  userId?: string | null,
  entryId?: string | null,
): JournalDraft | null {
  try {
    const raw = localStorage.getItem(journalDraftKey(userId, entryId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const source = parsed as Record<string, unknown>;
    const draft: JournalDraft = {
      taskId: text(source.taskId),
      situation: text(source.situation),
      trigger: text(source.trigger),
      evidenceFor: text(source.evidenceFor),
      evidenceAgainst: text(source.evidenceAgainst),
      reframed: text(source.reframed),
      moodBefore: mood(source.moodBefore),
      moodAfter: mood(source.moodAfter),
    };
    return isDraftEmpty(draft) ? null : draft;
  } catch {
    return null;
  }
}

export function saveJournalDraft(
  userId: string | null | undefined,
  draft: JournalDraft,
  entryId?: string | null,
): void {
  try {
    if (isDraftEmpty(draft)) {
      localStorage.removeItem(journalDraftKey(userId, entryId));
      return;
    }
    localStorage.setItem(journalDraftKey(userId, entryId), JSON.stringify(draft));
  } catch {
    // Storage denied or full — drafts are a convenience, never a blocker.
  }
}

/** Clears one draft only: the new-entry draft, or a single entry's edit draft. */
export function clearJournalDraft(userId?: string | null, entryId?: string | null): void {
  try {
    localStorage.removeItem(journalDraftKey(userId, entryId));
  } catch {
    // Storage denied — nothing to clean up.
  }
}
