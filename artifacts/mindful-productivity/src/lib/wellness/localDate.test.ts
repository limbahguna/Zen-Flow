import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { localDateInTimeZone, localDateKey, rollingSevenLocalDates, sevenLocalDateRange } from "./localDate";

const SOURCE = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "localDate.ts"), "utf8");

describe("localDateInTimeZone", () => {
  it("does not derive the calendar date from toISOString().slice(0, 10)", () => {
    expect(SOURCE).not.toContain("toISOString().slice(0, 10)");
    expect(SOURCE).toContain("formatToParts");
  });

  it("uses YYYY-MM-DD around UTC midnight in Asia/Jakarta", () => {
    const before = localDateInTimeZone("Asia/Jakarta", new Date("2026-01-14T16:59:00.000Z"));
    const atBoundary = localDateInTimeZone("Asia/Jakarta", new Date("2026-01-14T17:00:00.000Z"));
    expect(before.localDate).toBe("2026-01-14");
    expect(atBoundary.localDate).toBe("2026-01-15");
    expect(before.usedFallback).toBe(false);
  });

  it("uses YYYY-MM-DD around UTC midnight in Asia/Tokyo", () => {
    const before = localDateInTimeZone("Asia/Tokyo", new Date("2026-01-14T14:59:00.000Z"));
    const atBoundary = localDateInTimeZone("Asia/Tokyo", new Date("2026-01-14T15:00:00.000Z"));
    expect(before.localDate).toBe("2026-01-14");
    expect(atBoundary.localDate).toBe("2026-01-15");
  });

  it("uses YYYY-MM-DD around UTC midnight in America/New_York", () => {
    const stillPrevious = localDateInTimeZone(
      "America/New_York",
      new Date("2026-01-15T04:30:00.000Z"),
    );
    const nextDay = localDateInTimeZone("America/New_York", new Date("2026-01-15T05:30:00.000Z"));
    expect(stillPrevious.localDate).toBe("2026-01-14");
    expect(nextDay.localDate).toBe("2026-01-15");
  });

  it("falls back to UTC for an invalid timezone", () => {
    const instant = new Date("2026-09-19T00:30:00.000Z");
    const result = localDateInTimeZone("Not/AZone", instant);
    expect(result.usedFallback).toBe(true);
    expect(result.timeZone).toBe("UTC");
    expect(result.localDate).toBe("2026-09-19");
    expect(localDateKey("Not/AZone", instant)).toBe("2026-09-19");
  });
});

describe("rolling seven local dates", () => {
  it("returns today and the previous six dates, oldest first", () => {
    const dates = rollingSevenLocalDates("2026-09-20");
    expect(dates).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
    expect(dates.every((date) => date <= "2026-09-20")).toBe(true);
  });

  it("uses the saved-timezone date near UTC midnight", () => {
    const today = localDateKey("Asia/Jakarta", new Date("2026-09-19T17:00:00.000Z"));
    expect(today).toBe("2026-09-20");
    const range = sevenLocalDateRange(today);
    expect(range.end).toBe("2026-09-20");
    expect(range.start).toBe("2026-09-14");
    expect(range.dates).toHaveLength(7);
  });
});
