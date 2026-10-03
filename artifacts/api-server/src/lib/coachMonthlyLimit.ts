/** Soft-launch cap. Successful coach replies only, per UTC calendar month. */
export const SOFT_LAUNCH_MONTHLY_LIMIT = 10;

export function utcMonthStart(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function sumMonthlyUsage(
  rows: Array<{ usage_date?: string; count?: number }>,
  now: Date = new Date(),
): number {
  const start = utcMonthStart(now);
  const endMonth = now.getUTCMonth() === 11 ? 0 : now.getUTCMonth() + 1;
  const endYear = now.getUTCMonth() === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const end = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-01`;
  return rows.reduce((total, row) => {
    const day = row.usage_date ?? "";
    if (day < start || day >= end) return total;
    return total + Math.max(0, Number(row.count) || 0);
  }, 0);
}

export function monthlyRemaining(used: number): number {
  return Math.max(0, SOFT_LAUNCH_MONTHLY_LIMIT - used);
}
