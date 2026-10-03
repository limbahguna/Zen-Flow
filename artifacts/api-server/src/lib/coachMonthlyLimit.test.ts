import { describe, expect, it } from "vitest";
import {
  SOFT_LAUNCH_MONTHLY_LIMIT,
  monthlyRemaining,
  sumMonthlyUsage,
  utcMonthStart,
} from "./coachMonthlyLimit";

describe("soft-launch monthly coach usage", () => {
  it("caps a user at 10 successful messages", () => {
    expect(SOFT_LAUNCH_MONTHLY_LIMIT).toBe(10);
    expect(monthlyRemaining(0)).toBe(10);
    expect(monthlyRemaining(9)).toBe(1);
    expect(monthlyRemaining(10)).toBe(0);
    expect(monthlyRemaining(11)).toBe(0);
  });

  it("ignores the previous calendar month when the UTC month changes", () => {
    const september = new Date("2026-09-30T23:00:00.000Z");
    const october = new Date("2026-10-01T00:00:00.000Z");
    const rows = [
      { usage_date: "2026-09-01", count: 4 },
      { usage_date: "2026-09-30", count: 6 },
      { usage_date: "2026-10-01", count: 1 },
    ];

    expect(utcMonthStart(september)).toBe("2026-09-01");
    expect(sumMonthlyUsage(rows, september)).toBe(10);
    expect(monthlyRemaining(sumMonthlyUsage(rows, september))).toBe(0);

    expect(utcMonthStart(october)).toBe("2026-10-01");
    expect(sumMonthlyUsage(rows, october)).toBe(1);
    expect(monthlyRemaining(sumMonthlyUsage(rows, october))).toBe(9);
  });

  it("uses the UTC year boundary, not a local calendar", () => {
    const newYear = new Date("2027-01-01T00:30:00.000Z");
    expect(utcMonthStart(newYear)).toBe("2027-01-01");
    expect(sumMonthlyUsage([
      { usage_date: "2026-12-31", count: 10 },
      { usage_date: "2027-01-01", count: 2 },
    ], newYear)).toBe(2);
  });
});
