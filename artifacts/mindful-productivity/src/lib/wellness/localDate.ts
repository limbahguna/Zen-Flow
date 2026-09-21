export interface LocalDateResult {
  localDate: string;
  timeZone: string;
  usedFallback: boolean;
}

const UTC = "UTC";

function pad(value: string): string {
  return value.padStart(2, "0");
}

function formatParts(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new RangeError("Incomplete date parts");
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function isUsableTimeZone(timeZone: string): boolean {
  const trimmed = timeZone.trim();
  if (!trimmed || trimmed.length > 100) return false;
  try {
    formatParts(new Date(), trimmed);
    return true;
  } catch {
    return false;
  }
}

/** Calendar date YYYY-MM-DD in an IANA timezone via formatToParts. */
export function localDateInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): LocalDateResult {
  const requested = typeof timeZone === "string" ? timeZone.trim() : "";
  if (isUsableTimeZone(requested)) {
    return {
      localDate: formatParts(now, requested),
      timeZone: requested,
      usedFallback: false,
    };
  }
  return {
    localDate: formatParts(now, UTC),
    timeZone: UTC,
    usedFallback: true,
  };
}

export function localDateKey(timeZone: string, now: Date = new Date()): string {
  return localDateInTimeZone(timeZone, now).localDate;
}

/** Civil YYYY-MM-DD arithmetic (not instant conversion via toISOString). */
export function shiftLocalDate(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map((part) => Number(part));
  const shifted = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
  const y = String(shifted.getUTCFullYear());
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function previousLocalDate(localDate: string): string {
  return shiftLocalDate(localDate, -1);
}

/** Today plus the previous six local dates, oldest first. Never includes a future date. */
export function rollingSevenLocalDates(today: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftLocalDate(today, index - 6));
}

export function sevenLocalDateRange(today: string): {
  start: string;
  end: string;
  dates: string[];
} {
  const dates = rollingSevenLocalDates(today);
  return { start: dates[0]!, end: dates[dates.length - 1]!, dates };
}

/** Device IANA timezone, falling back to UTC when unresolved or unusable. */
export function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (isUsableTimeZone(zone)) return zone.trim();
  } catch {
    // Intl or resolvedOptions unavailable
  }
  return UTC;
}
