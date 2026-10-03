import { describe, expect, it } from "vitest";
import { journalMoodMessageKey, journalReflection } from "./journalReflection";

const base = {
  mood_before: 4 as number | null,
  mood_after: 8 as number | null,
  reframed_thought: "One deadline is not everything" as string | null,
};

describe("journalReflection", () => {
  it("treats a higher score as a better mood and reports the size as a positive number", () => {
    const summary = journalReflection({ ...base, mood_before: 4, mood_after: 8 });
    expect(summary.direction).toBe("up");
    expect(summary.change).toBe(4);
    expect(journalMoodMessageKey(summary.direction)).toBe("journal.form.done.mood.improved");
  });

  it("treats an unchanged score as no change", () => {
    const summary = journalReflection({ ...base, mood_before: 6, mood_after: 6 });
    expect(summary.direction).toBe("same");
    expect(summary.change).toBe(0);
    expect(journalMoodMessageKey(summary.direction)).toBe("journal.form.done.mood.same");
  });

  it("treats a lower score as a harder mood without a negative size", () => {
    const summary = journalReflection({ ...base, mood_before: 8, mood_after: 2 });
    expect(summary.direction).toBe("down");
    expect(summary.change).toBe(6);
    expect(summary.change).toBeGreaterThanOrEqual(0);
    expect(journalMoodMessageKey(summary.direction)).toBe("journal.form.done.mood.lower");
  });

  it("does not invent a mood result when a score is missing", () => {
    const summary = journalReflection({ ...base, mood_before: null, mood_after: 8 });
    expect(summary.direction).toBe("missing");
    expect(summary.change).toBeNull();
    expect(summary.before).toBeNull();
    expect(summary.after).toBeNull();
    expect(journalMoodMessageKey(summary.direction)).toBeNull();
  });

  it("keeps question 5 exactly as saved and leaves it empty when blank", () => {
    expect(journalReflection(base).perspective).toBe("One deadline is not everything");
    expect(journalReflection({ ...base, reframed_thought: "  tetap kata saya  " }).perspective).toBe(
      "tetap kata saya",
    );
    expect(journalReflection({ ...base, reframed_thought: "   " }).perspective).toBe("");
    expect(journalReflection({ ...base, reframed_thought: null }).perspective).toBe("");
  });
});
