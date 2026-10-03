/**
 * Calendar-day grouping for Journal entries.
 *
 * `journal_entries.created_at` is a UTC instant. Grouping it by calendar day
 * has to happen in the reader's own timezone, so an entry written just after
 * local midnight stays on the day the user experienced it.
 *
 * Two patterns are deliberately avoided here:
 *   - `created_at.slice(0, 10)`, which yields the UTC date, not the local one.
 *   - `localMidnight.toISOString().slice(0, 10)`, which converts back to UTC
 *     and lands on the previous day for every positive offset.
 *
 * Day stepping uses `previousLocalDate` from wellness/localDate, which does
 * civil YYYY-MM-DD arithmetic rather than subtracting 24 hours, so it stays
 * correct across daylight-saving transitions.
 */

import { deviceTimeZone, previousLocalDate } from "./wellness/localDate";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    formatter = formatterFor("UTC");
  }
  formatters.set(timeZone, formatter);
  return formatter;
}

/**
 * Calendar date (YYYY-MM-DD) of an instant, as seen in `timeZone`.
 * Returns "" for an unparseable value so it can never match a real day.
 */
export function journalDayKey(
  value: string | Date,
  timeZone: string = deviceTimeZone(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = formatterFor(timeZone).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "";

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export interface JournalStreakOptions {
  /** The moment "today" is measured from. Defaults to now. */
  now?: Date;
  /** IANA timezone to group by. Defaults to the device timezone. */
  timeZone?: string;
}

/**
 * Consecutive local days ending today — or yesterday, when nothing has been
 * written yet today, so an in-progress day never breaks an existing streak.
 */
export function journalStreak(
  createdAtValues: Iterable<string>,
  options: JournalStreakOptions = {},
): number {
  const timeZone = options.timeZone ?? deviceTimeZone();
  const now = options.now ?? new Date();

  const writtenDays = new Set<string>();
  for (const value of createdAtValues) {
    const key = journalDayKey(value, timeZone);
    if (key) writtenDays.add(key);
  }
  if (writtenDays.size === 0) return 0;

  let cursor = journalDayKey(now, timeZone);
  if (!writtenDays.has(cursor)) cursor = previousLocalDate(cursor);

  let streak = 0;
  while (writtenDays.has(cursor)) {
    streak++;
    cursor = previousLocalDate(cursor);
  }
  return streak;
}
