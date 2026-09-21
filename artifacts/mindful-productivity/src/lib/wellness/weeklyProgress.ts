import { getProgram } from "./programCatalog";
import { previousLocalDate, sevenLocalDateRange } from "./localDate";
import type {
  DailyActivity,
  DailyPlanItemKey,
  DailyPlanSnapshot,
  ProgramEnrollment,
  ProgramSlug,
} from "./types";
import { isProgramSlug } from "./types";

export type ConsistencyState = "completed" | "partial" | "none";
export type MoodDirection = "higher" | "steady" | "lower" | "none";
export type ConsistencyLead = "practice" | "insight" | "mood" | "none";

export interface DayConsistency {
  localDate: string;
  isToday: boolean;
  state: ConsistencyState;
}

export interface WeeklyProgressReport {
  today: string;
  start: string;
  end: string;
  dates: string[];
  days: DayConsistency[];
  plansCreated: number;
  plansCompleted: number;
  planCompletionRate: number | null;
  requiredTotal: number;
  requiredCompleted: number;
  requiredRate: number | null;
  practiceCount: number;
  practiceMinutes: number | null;
  insightReadCount: number;
  moodCount: number;
  moodAverage: number | null;
  moodDirection: MoodDirection;
  reflectionCount: number;
  streak: number;
  programSlug: ProgramSlug | null;
  programDay: number | null;
  programDuration: number | null;
  programPercent: number | null;
  programCompleted: boolean;
  completedProgramDays: number | null;
  consistencyLead: ConsistencyLead;
}

function uniqueActivityKeys(rows: DailyActivity[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(`${row.daily_plan_id}:${row.item_key}`);
  }
  return keys;
}

export function dailyPlanStreak(completedDates: Iterable<string>, today: string): number {
  const completed = new Set(completedDates);
  let cursor = today;
  if (!completed.has(today)) {
    cursor = previousLocalDate(today);
    if (!completed.has(cursor)) return 0;
  }
  let streak = 0;
  while (completed.has(cursor)) {
    streak += 1;
    cursor = previousLocalDate(cursor);
  }
  return streak;
}

export function moodDirectionFromScores(scores: Array<{ localDate: string; completedAt: string; score: number }>): MoodDirection {
  if (scores.length < 2) return "none";
  const ordered = [...scores].sort((a, b) => {
    if (a.localDate !== b.localDate) return a.localDate.localeCompare(b.localDate);
    return a.completedAt.localeCompare(b.completedAt);
  });
  const first = ordered[0]!.score;
  const last = ordered[ordered.length - 1]!.score;
  if (last > first) return "higher";
  if (last < first) return "lower";
  return "steady";
}

export function completedProgramDays(
  enrollment: Pick<ProgramEnrollment, "status" | "current_day" | "program_slug"> | null,
): { slug: ProgramSlug | null; day: number | null; duration: number | null; completedDays: number | null; percent: number | null; completed: boolean } {
  if (!enrollment || !isProgramSlug(enrollment.program_slug)) {
    return { slug: null, day: null, duration: null, completedDays: null, percent: null, completed: false };
  }
  const duration = getProgram(enrollment.program_slug).durationDays;
  const completed = enrollment.status === "completed";
  const completedDays = completed
    ? duration
    : Math.max(0, Math.min(duration, enrollment.current_day - 1));
  const percent = duration > 0 ? Math.min(100, Math.round((completedDays / duration) * 100)) : 0;
  return {
    slug: enrollment.program_slug,
    day: enrollment.current_day,
    duration,
    completedDays,
    percent,
    completed,
  };
}

export function aggregateWeeklyProgress(input: {
  today: string;
  plans: DailyPlanSnapshot[];
  activities: DailyActivity[];
  enrollment: ProgramEnrollment | null;
}): WeeklyProgressReport {
  const range = sevenLocalDateRange(input.today);
  const plansByDate = new Map<string, DailyPlanSnapshot>();
  for (const plan of input.plans) {
    if (plan.local_date < range.start || plan.local_date > range.end) continue;
    plansByDate.set(plan.local_date, plan);
  }
  const inRangeActivities = input.activities.filter(
    (row) => row.local_date >= range.start && row.local_date <= range.end,
  );
  const activityKeys = uniqueActivityKeys(inRangeActivities);

  const days: DayConsistency[] = range.dates.map((localDate) => {
    const plan = plansByDate.get(localDate);
    let state: ConsistencyState = "none";
    if (plan?.completed_at) state = "completed";
    else if (plan) state = "partial";
    return { localDate, isToday: localDate === input.today, state };
  });

  const plansCreated = plansByDate.size;
  const plansCompleted = [...plansByDate.values()].filter((plan) => plan.completed_at != null).length;
  const planCompletionRate = plansCreated === 0 ? null : plansCompleted / plansCreated;

  let requiredTotal = 0;
  let requiredCompleted = 0;
  for (const plan of plansByDate.values()) {
    for (const item of plan.items) {
      if (!item.required) continue;
      requiredTotal += 1;
      if (activityKeys.has(`${plan.id}:${item.item_key}`)) requiredCompleted += 1;
    }
  }
  const requiredRate = requiredTotal === 0 ? null : requiredCompleted / requiredTotal;

  const practiceRows = uniqueTyped(inRangeActivities, "program_practice");
  const insightRows = uniqueTyped(inRangeActivities, "daily_insight");
  const moodRows = uniqueTyped(inRangeActivities, "mood_checkin");
  const reflectionRows = uniqueTyped(inRangeActivities, "reflection");

  const practiceMinutesValues = practiceRows
    .map((row) => row.duration_minutes)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const practiceMinutes = practiceMinutesValues.length > 0
    ? practiceMinutesValues.reduce((sum, value) => sum + value, 0)
    : null;

  const moodScores = moodRows
    .filter((row) => typeof row.mood_score === "number")
    .map((row) => ({
      localDate: row.local_date,
      completedAt: row.completed_at,
      score: row.mood_score as number,
    }));
  const moodAverage =
    moodScores.length === 0
      ? null
      : Math.round((moodScores.reduce((sum, row) => sum + row.score, 0) / moodScores.length) * 10) / 10;

  const completedDates = [...plansByDate.values()]
    .filter((plan) => plan.completed_at != null)
    .map((plan) => plan.local_date);

  const program = completedProgramDays(input.enrollment);
  const practiceCount = practiceRows.length;
  const insightReadCount = insightRows.length;
  const moodCount = moodRows.length;
  const leadScores: Array<[ConsistencyLead, number]> = [
    ["practice", practiceCount],
    ["insight", insightReadCount],
    ["mood", moodCount],
  ];
  const maxLead = Math.max(...leadScores.map(([, count]) => count));
  const consistencyLead = maxLead > 0 ? leadScores.find(([, count]) => count === maxLead)![0] : "none";

  return {
    today: input.today,
    start: range.start,
    end: range.end,
    dates: range.dates,
    days,
    plansCreated,
    plansCompleted,
    planCompletionRate,
    requiredTotal,
    requiredCompleted,
    requiredRate,
    practiceCount,
    practiceMinutes,
    insightReadCount,
    moodCount,
    moodAverage,
    moodDirection: moodDirectionFromScores(moodScores),
    reflectionCount: reflectionRows.length,
    streak: dailyPlanStreak(completedDates, input.today),
    programSlug: program.slug,
    programDay: program.day,
    programDuration: program.duration,
    programPercent: program.percent,
    programCompleted: program.completed,
    completedProgramDays: program.completedDays,
    consistencyLead,
  };
}

function uniqueTyped(rows: DailyActivity[], key: DailyPlanItemKey): DailyActivity[] {
  const seen = new Set<string>();
  const unique: DailyActivity[] = [];
  for (const row of rows) {
    if (row.item_key !== key) continue;
    const id = `${row.daily_plan_id}:${row.item_key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(row);
  }
  return unique;
}
