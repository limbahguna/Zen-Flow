import type { TaskRow } from "./tasks";
import type { AnxietyCheckRow } from "./anxietyChecks";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDayKey(iso: string): string {
  return dayKey(new Date(iso));
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// The seven dates (Mon -> Sun) of the week that contains today.
export function weekDates(now = new Date()): Date[] {
  const day = now.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - diffToMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export interface DayRatio {
  planned: number;
  done: number;
  ratio: number;
}

function ratioForDay(tasks: TaskRow[], key: string): DayRatio {
  let planned = 0;
  let done = 0;
  for (const t of tasks) {
    if (parseDayKey(t.created_at) === key) planned++;
    if (t.status === "done" && t.completed_at && parseDayKey(t.completed_at) === key) {
      done++;
    }
  }
  const ratio = planned === 0 ? 0 : clampPct((done / planned) * 100);
  return { planned, done, ratio };
}

export function todayRatio(tasks: TaskRow[]): DayRatio {
  return ratioForDay(tasks, dayKey(new Date()));
}

// Color scheme shared by the ratio ring and the weekly bars.
export function ratioColor(ratio: number): string {
  if (ratio <= 30) return "#D4806A";
  if (ratio <= 60) return "#D4B96A";
  return "#8FA680";
}

export function tasksCreatedToday(tasks: TaskRow[]): number {
  const key = dayKey(new Date());
  return tasks.filter((t) => parseDayKey(t.created_at) === key).length;
}

export function tasksCompletedToday(tasks: TaskRow[]): number {
  const key = dayKey(new Date());
  return tasks.filter(
    (t) => t.status === "done" && t.completed_at && parseDayKey(t.completed_at) === key,
  ).length;
}

// Consecutive days (ending today, or yesterday if nothing done yet today) with at
// least one completed task.
export function currentStreak(tasks: TaskRow[]): number {
  const doneDays = new Set(
    tasks
      .filter((t) => t.status === "done" && t.completed_at)
      .map((t) => parseDayKey(t.completed_at as string)),
  );
  if (doneDays.size === 0) return 0;

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!doneDays.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (doneDays.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function avgAnxietyToday(checks: AnxietyCheckRow[]): number | null {
  const key = dayKey(new Date());
  const todays = checks.filter((c) => parseDayKey(c.created_at) === key);
  if (todays.length === 0) return null;
  const sum = todays.reduce((acc, c) => acc + (c.intensity ?? 0), 0);
  return Math.round((sum / todays.length) * 10) / 10;
}

export interface WeeklyBar extends DayRatio {
  label: string;
  isFuture: boolean;
}

export function weeklyTrend(tasks: TaskRow[]): WeeklyBar[] {
  const today = dayKey(new Date());
  return weekDates().map((d, i) => {
    const key = dayKey(d);
    return {
      label: WEEKDAY_LABELS[i],
      isFuture: key > today,
      ...ratioForDay(tasks, key),
    };
  });
}

export interface MoodPoint {
  label: string;
  avg: number | null; // average anxiety intensity (1-10), null when no checks
  isFuture: boolean;
}

export function moodTrend(checks: AnxietyCheckRow[]): MoodPoint[] {
  const today = dayKey(new Date());
  return weekDates().map((d, i) => {
    const key = dayKey(d);
    const dayChecks = checks.filter((c) => parseDayKey(c.created_at) === key);
    const avg =
      dayChecks.length === 0
        ? null
        : Math.round(
            (dayChecks.reduce((acc, c) => acc + (c.intensity ?? 0), 0) / dayChecks.length) * 10,
          ) / 10;
    return { label: WEEKDAY_LABELS[i], avg, isFuture: key > today };
  });
}

export type MoodDirection = "improving" | "worse" | "steady" | "insufficient";

export function moodDirection(points: MoodPoint[]): MoodDirection {
  const values = points.filter((p) => p.avg !== null).map((p) => p.avg as number);
  if (values.length < 2) return "insufficient";

  const mid = Math.ceil(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const earlier = avg(firstHalf);
  const recent = avg(secondHalf.length ? secondHalf : firstHalf);

  const delta = recent - earlier;
  if (delta <= -0.5) return "improving";
  if (delta >= 0.5) return "worse";
  return "steady";
}
