/**
 * Journal calendar-day grouping.
 *
 * Determinism: every test passes an explicit IANA timezone and an explicit
 * `now`, so results do not depend on the machine's TZ or clock. The suite is
 * safe to run under any system timezone; no global TZ setting is required.
 *
 * Zones used:
 *   Asia/Jakarta      UTC+07:00, no DST  — the reported bug
 *   America/New_York  UTC-05:00/-04:00   — negative offset, with DST
 *   Pacific/Auckland  UTC+12:00/+13:00   — large positive offset, with DST
 */

import { describe, expect, it } from "vitest";
import { journalDayKey, journalStreak } from "./journalStreak";

const JAKARTA = "Asia/Jakarta";
const NEW_YORK = "America/New_York";
const AUCKLAND = "Pacific/Auckland";

describe("journalDayKey", () => {
  it("keeps an entry written just after local midnight on that local date", () => {
    // 2026-09-22 00:30 in Jakarta is 2026-09-21 17:30 UTC.
    const key = journalDayKey("2026-09-21T17:30:00.000Z", JAKARTA);
    expect(key).toBe("2026-09-22");
    // The old `created_at.slice(0, 10)` would have produced the previous day.
    expect(key).not.toBe("2026-09-21T17:30:00.000Z".slice(0, 10));
  });

  it("keeps an entry written just before local midnight on that local date", () => {
    // 2026-09-22 23:30 in Jakarta is 2026-09-22 16:30 UTC.
    expect(journalDayKey("2026-09-22T16:30:00.000Z", JAKARTA)).toBe("2026-09-22");
  });

  it("resolves an instant near UTC midnight to the correct local date", () => {
    // 2026-09-21 23:30 UTC is already 2026-09-22 06:30 in Jakarta.
    expect(journalDayKey("2026-09-21T23:30:00.000Z", JAKARTA)).toBe("2026-09-22");
    // The same instant is still 2026-09-21 in New York.
    expect(journalDayKey("2026-09-21T23:30:00.000Z", NEW_YORK)).toBe("2026-09-21");
    // And already 2026-09-22 in Auckland.
    expect(journalDayKey("2026-09-21T23:30:00.000Z", AUCKLAND)).toBe("2026-09-22");
  });

  it("handles negative offsets where UTC has already rolled over", () => {
    // 2026-09-22 01:00 UTC is 2026-09-21 21:00 in New York.
    expect(journalDayKey("2026-09-22T01:00:00.000Z", NEW_YORK)).toBe("2026-09-21");
  });

  it("stays correct on both sides of a daylight-saving transition", () => {
    // US DST ends 2026-11-01 at 02:00 local; both instants are the same local day.
    expect(journalDayKey("2026-11-01T05:30:00.000Z", NEW_YORK)).toBe("2026-11-01");
    expect(journalDayKey("2026-11-01T06:30:00.000Z", NEW_YORK)).toBe("2026-11-01");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(journalDayKey(new Date("2026-09-21T17:30:00.000Z"), JAKARTA)).toBe("2026-09-22");
  });

  it("returns an empty key for an unparseable timestamp", () => {
    expect(journalDayKey("not-a-date", JAKARTA)).toBe("");
  });

  it("falls back to UTC for an unusable timezone instead of throwing", () => {
    expect(journalDayKey("2026-09-21T23:30:00.000Z", "Not/AZone")).toBe("2026-09-21");
  });
});

describe("journalStreak", () => {
  const now = new Date("2026-09-22T05:00:00.000Z"); // 2026-09-22 12:00 in Jakarta

  it("counts two consecutive days in Asia/Jakarta", () => {
    const entries = [
      "2026-09-22T02:00:00.000Z", // 09-22 09:00 local
      "2026-09-21T02:00:00.000Z", // 09-21 09:00 local
    ];
    expect(journalStreak(entries, { now, timeZone: JAKARTA })).toBe(2);
  });

  it("counts an entry written just after local midnight as today", () => {
    // 2026-09-22 00:30 local. Under the old UTC keying this landed on 09-21.
    const entries = ["2026-09-21T17:30:00.000Z", "2026-09-20T17:30:00.000Z"];
    expect(journalStreak(entries, { now, timeZone: JAKARTA })).toBe(2);
  });

  it("counts an entry written just before local midnight as that day", () => {
    // 2026-09-21 23:30 local plus today, so the streak spans two local days.
    const entries = ["2026-09-22T02:00:00.000Z", "2026-09-21T16:30:00.000Z"];
    expect(journalStreak(entries, { now, timeZone: JAKARTA })).toBe(2);
  });

  it("breaks the streak on a one-day gap", () => {
    const entries = [
      "2026-09-22T02:00:00.000Z", // 09-22
      "2026-09-20T02:00:00.000Z", // 09-20, so 09-21 is missing
      "2026-09-19T02:00:00.000Z",
    ];
    expect(journalStreak(entries, { now, timeZone: JAKARTA })).toBe(1);
  });

  it("counts several entries on one local date as a single day", () => {
    const entries = [
      "2026-09-21T17:30:00.000Z", // 09-22 00:30 local
      "2026-09-22T02:00:00.000Z", // 09-22 09:00 local
      "2026-09-22T14:00:00.000Z", // 09-22 21:00 local
    ];
    expect(journalStreak(entries, { now, timeZone: JAKARTA })).toBe(1);
  });

  it("returns zero when nothing has been written recently", () => {
    const entries = ["2026-09-15T02:00:00.000Z", "2026-09-14T02:00:00.000Z"];
    expect(journalStreak(entries, { now, timeZone: JAKARTA })).toBe(0);
  });

  it("returns zero for no entries at all", () => {
    expect(journalStreak([], { now, timeZone: JAKARTA })).toBe(0);
  });

  it("keeps yesterday's streak alive before anything is written today", () => {
    const entries = [
      "2026-09-21T02:00:00.000Z", // 09-21
      "2026-09-20T02:00:00.000Z", // 09-20
      "2026-09-19T02:00:00.000Z", // 09-19
    ];
    expect(journalStreak(entries, { now, timeZone: JAKARTA })).toBe(3);
  });

  it("counts a long positive streak across a month boundary", () => {
    const entries = [
      "2026-09-02T02:00:00.000Z",
      "2026-09-01T02:00:00.000Z",
      "2026-08-31T02:00:00.000Z",
      "2026-08-30T02:00:00.000Z",
    ];
    const septemberSecond = new Date("2026-09-02T05:00:00.000Z");
    expect(journalStreak(entries, { now: septemberSecond, timeZone: JAKARTA })).toBe(4);
  });

  it("counts consecutive days across a daylight-saving change", () => {
    // US DST ends 2026-11-01; 11-02, 11-01 and 10-31 are consecutive local days.
    const entries = [
      "2026-11-02T17:00:00.000Z", // 11-02 12:00 EST
      "2026-11-01T17:00:00.000Z", // 11-01 12:00 EST
      "2026-10-31T16:00:00.000Z", // 10-31 12:00 EDT
    ];
    const novemberSecond = new Date("2026-11-02T17:30:00.000Z");
    expect(journalStreak(entries, { now: novemberSecond, timeZone: NEW_YORK })).toBe(3);
  });

  it("groups by the reader's timezone, not by UTC", () => {
    // Two instants two hours apart that straddle midnight in Jakarta but sit
    // in the same afternoon in New York:
    //   16:00Z → 09-21 23:00 Jakarta / 09-21 12:00 New York
    //   18:00Z → 09-22 01:00 Jakarta / 09-21 14:00 New York
    // So they are two consecutive local days in Jakarta and one day in New York.
    const entries = ["2026-09-21T16:00:00.000Z", "2026-09-21T18:00:00.000Z"];

    expect(journalStreak(entries, { now, timeZone: JAKARTA })).toBe(2);

    const newYorkNow = new Date("2026-09-21T20:00:00.000Z"); // 09-21 16:00 EDT
    expect(journalStreak(entries, { now: newYorkNow, timeZone: NEW_YORK })).toBe(1);
  });

  it("ignores unparseable timestamps rather than counting them", () => {
    const entries = ["2026-09-22T02:00:00.000Z", "not-a-date"];
    expect(journalStreak(entries, { now, timeZone: JAKARTA })).toBe(1);
  });
});
