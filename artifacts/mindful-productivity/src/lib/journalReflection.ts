import type { JournalEntryRow } from "./journal";

/**
 * What the saved-entry summary can say without inventing anything.
 *
 * Mood direction follows the rest of the Journal: a higher score is a better
 * mood, and the size of a change is always shown as a positive number.
 * Question 5 is the user's own words; an empty answer stays empty.
 */
export type JournalMoodDirection = "up" | "down" | "same" | "missing";

export interface JournalReflection {
  direction: JournalMoodDirection;
  /** Absolute size of the mood change. Null when either score is missing. */
  change: number | null;
  before: number | null;
  after: number | null;
  /** Question 5, trimmed. Empty string when the user left it blank. */
  perspective: string;
}

export function journalReflection(entry: Pick<
  JournalEntryRow,
  "mood_before" | "mood_after" | "reframed_thought"
>): JournalReflection {
  const before = entry.mood_before;
  const after = entry.mood_after;
  const hasMood = typeof before === "number" && typeof after === "number";
  const perspective = (entry.reframed_thought ?? "").trim();

  if (!hasMood) {
    return { direction: "missing", change: null, before: null, after: null, perspective };
  }

  const delta = after - before;
  return {
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "same",
    change: Math.abs(delta),
    before,
    after,
    perspective,
  };
}

/** Supportive line. Missing scores get no direction claim at all. */
export function journalMoodMessageKey(direction: JournalMoodDirection): string | null {
  if (direction === "up") return "journal.form.done.mood.improved";
  if (direction === "down") return "journal.form.done.mood.lower";
  if (direction === "same") return "journal.form.done.mood.same";
  return null;
}
