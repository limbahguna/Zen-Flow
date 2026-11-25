/**
 * KindEase Stress Check — a daily estimate, not a diagnosis.
 *
 * Every component is 0–100 where higher means more estimated stress.
 * Missing signals are omitted and the remaining weights are renormalized
 * so they still sum to 1. A day with no signals returns score: null.
 *
 * Local dates are YYYY-MM-DD civil dates. Instants are grouped with
 * journalDayKey (timezone-aware). Never use created_at.slice(0, 10).
 */

import { journalDayKey } from "./journalStreak";
import { previousLocalDate } from "./wellness/localDate";

export const STRESS_ALGORITHM_VERSION = 1;

export const STRESS_WEIGHTS = {
  anxiety: 0.3,
  mood: 0.2,
  sleep: 0.2,
  followThrough: 0.15,
  streak: 0.05,
  sentiment: 0.1,
} as const;

export type StressComponentName = keyof typeof STRESS_WEIGHTS;
export type StressLevel = "calm" | "mild" | "elevated" | "high" | "unknown";
export type StressConfidence = "none" | "low" | "medium" | "high";

export type AnxietyFeeling =
  | "anxious"
  | "afraid"
  | "overwhelmed"
  | "neutral"
  | "excited"
  | "calm";

export interface AnxietySignal {
  intensity: number;
  feeling: AnxietyFeeling;
  breathingOffered: boolean;
  breathingCompleted: boolean;
}

export interface SleepSignal {
  quality: number;
  energy: number;
  feeling: "rested" | "okay" | "tired" | "restless";
  routineCompleted: boolean;
}

export interface FollowThroughSignal {
  planExists: boolean;
  requiredCount: number;
  missedRequired: number;
  /** A daily or selected-day intention was due on this local date. */
  intentionDue: boolean;
  intentionMissed: boolean;
  /** A task was created that local day (or was still in progress). */
  taskRelevant: boolean;
  taskAbandonedOrPostponed: boolean;
}

export interface StreakSignal {
  /** False when the user has no plan or journal streak history at all. */
  hasHistory: boolean;
  /** A daily-plan or journal streak of at least 2 ended on this date. */
  broke: boolean;
}

export interface StressDayInput {
  anxietyChecks?: AnxietySignal[];
  journalMoodAfter?: number | null;
  journalMoodBefore?: number | null;
  /** Daily-plan mood, 1–5. Higher is better. */
  dailyPlanMood?: number | null;
  sleep?: SleepSignal | null;
  followThrough?: FollowThroughSignal | null;
  streak?: StreakSignal | null;
  /** Optional 0–100 journal distress. Never invented when absent. */
  journalSentiment?: number | null;
  /** Viewing today while the only source is older than today. */
  staleSingleSource?: boolean;
}

export interface StressComponentDetail {
  value: number;
  weight: number;
  mean?: number;
}

export interface StressEstimate {
  score: number | null;
  level: StressLevel;
  confidence: StressConfidence;
  components: Partial<Record<StressComponentName, StressComponentDetail>>;
  recommendationKeys: string[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Anxiety. intensity i in 1–10 → round(((i - 1) / 9) * 100).
 * Several checks use the max (worst moment); mean is kept for the UI.
 * Feeling: anxious|afraid|overwhelmed +8, calm|excited −8, neutral 0.
 * Breathing offered and not completed: +5.
 */
export function mapAnxietyChecks(checks: AnxietySignal[]): { value: number; mean: number } | null {
  if (checks.length === 0) return null;
  const mapped = checks.map((check) => {
    const intensity = Math.min(10, Math.max(1, check.intensity));
    let score = Math.round(((intensity - 1) / 9) * 100);
    if (check.feeling === "anxious" || check.feeling === "afraid" || check.feeling === "overwhelmed") {
      score += 8;
    } else if (check.feeling === "calm" || check.feeling === "excited") {
      score -= 8;
    }
    if (check.breathingOffered && !check.breathingCompleted) score += 5;
    return clampScore(score);
  });
  const mean = mapped.reduce((sum, value) => sum + value, 0) / mapped.length;
  return { value: Math.max(...mapped), mean };
}

/** Journal mood m in 2–10 (higher is better) → round(((10 - m) / 8) * 100). */
export function mapJournalMood(mood: number): number {
  const m = Math.min(10, Math.max(2, mood));
  return clampScore(((10 - m) / 8) * 100);
}

/**
 * Prefer journal mood_after, else mood_before.
 * Daily-plan mood 1–5 is rescaled with score * 2 onto the 2–10 scale.
 * When both exist, average the two mapped values.
 */
export function mapMood(input: Pick<StressDayInput, "journalMoodAfter" | "journalMoodBefore" | "dailyPlanMood">): number | null {
  const journal = input.journalMoodAfter ?? input.journalMoodBefore ?? null;
  const journalMapped = journal == null ? null : mapJournalMood(journal);
  const planMapped = input.dailyPlanMood == null ? null : mapJournalMood(input.dailyPlanMood * 2);
  if (journalMapped != null && planMapped != null) return clampScore((journalMapped + planMapped) / 2);
  return journalMapped ?? planMapped;
}

/**
 * Sleep. quality q 1–5 → round(((5 - q) / 4) * 100), then 70% quality + 30% energy
 * (energy uses the same invert). tired|restless +8, rested −8, okay 0.
 * Completed wind-down −5. No duration term.
 */
export function mapSleep(sleep: SleepSignal): number {
  const quality = Math.min(5, Math.max(1, sleep.quality));
  const energy = Math.min(5, Math.max(1, sleep.energy));
  const qualityStress = Math.round(((5 - quality) / 4) * 100);
  const energyStress = Math.round(((5 - energy) / 4) * 100);
  let score = qualityStress * 0.7 + energyStress * 0.3;
  if (sleep.feeling === "tired" || sleep.feeling === "restless") score += 8;
  else if (sleep.feeling === "rested") score -= 8;
  if (sleep.routineCompleted) score -= 5;
  return clampScore(score);
}

/**
 * Follow-through. If a plan exists, missRate = missedRequired / requiredCount
 * (0 when nothing is required) → round(missRate * 100).
 * +15 when a due intention was not done, or a relevant task was abandoned
 * or postponed. Absent when there is no plan and nothing was due.
 */
export function mapFollowThrough(signal: FollowThroughSignal): number | null {
  const due = signal.planExists || signal.intentionDue || signal.taskRelevant;
  if (!due) return null;
  let score = 0;
  if (signal.planExists) {
    const missRate = signal.requiredCount <= 0 ? 0 : signal.missedRequired / signal.requiredCount;
    score = Math.round(missRate * 100);
  }
  if (signal.intentionMissed || signal.taskAbandonedOrPostponed) score += 15;
  return clampScore(score);
}

export function mapStreak(signal: StreakSignal): number | null {
  if (!signal.hasHistory) return null;
  return signal.broke ? 100 : 0;
}

export function levelFromScore(score: number): Exclude<StressLevel, "unknown"> {
  if (score <= 24) return "calm";
  if (score <= 49) return "mild";
  if (score <= 74) return "elevated";
  return "high";
}

function confidenceFor(
  names: StressComponentName[],
  staleSingleSource: boolean,
): StressConfidence {
  if (names.length === 0) return "none";
  let confidence: StressConfidence = "low";
  if (names.length >= 4) confidence = "high";
  else if (names.length >= 2) confidence = "medium";
  const hasBodySignal = names.some(
    (name) => name === "anxiety" || name === "mood" || name === "sleep" || name === "sentiment",
  );
  if (!hasBodySignal && confidence !== "low") {
    confidence = confidence === "high" ? "medium" : "low";
  }
  if (staleSingleSource && names.length === 1) confidence = "low";
  return confidence;
}

const RECOMMENDATION_FOR: Record<StressComponentName, string> = {
  anxiety: "stress.recommend.breathing",
  followThrough: "stress.recommend.plan",
  mood: "stress.recommend.journal",
  sentiment: "stress.recommend.journal",
  sleep: "stress.recommend.sleep",
  streak: "stress.recommend.coach",
};

function recommendationKeys(
  ranked: StressComponentName[],
  followThrough: FollowThroughSignal | null | undefined,
): string[] {
  const keys: string[] = [];
  const push = (key: string) => {
    if (!keys.includes(key) && keys.length < 2) keys.push(key);
  };
  for (const name of ranked) {
    if (name === "followThrough") {
      if (followThrough?.planExists && followThrough.missedRequired > 0) push("stress.recommend.plan");
      if (followThrough?.intentionMissed) push("stress.recommend.intention");
      if (keys.length === 0) push("stress.recommend.plan");
      continue;
    }
    push(RECOMMENDATION_FOR[name]);
    if ((name === "mood" || name === "sentiment") && keys.includes("stress.recommend.journal")) {
      push("stress.recommend.coach");
    }
  }
  if (keys.length === 0) push("stress.recommend.coach");
  return keys.slice(0, 2);
}

export function computeDailyStressEstimate(input: StressDayInput): StressEstimate {
  const present = new Map<StressComponentName, { value: number; mean?: number }>();

  const anxiety = input.anxietyChecks?.length ? mapAnxietyChecks(input.anxietyChecks) : null;
  if (anxiety) present.set("anxiety", anxiety);

  const mood = mapMood(input);
  if (mood != null) present.set("mood", { value: mood });

  if (input.sleep) present.set("sleep", { value: mapSleep(input.sleep) });

  if (input.followThrough) {
    const value = mapFollowThrough(input.followThrough);
    if (value != null) present.set("followThrough", { value });
  }

  if (input.streak) {
    const value = mapStreak(input.streak);
    if (value != null) present.set("streak", { value });
  }

  if (input.journalSentiment != null && Number.isFinite(input.journalSentiment)) {
    present.set("sentiment", { value: clampScore(input.journalSentiment) });
  }

  if (present.size === 0) {
    return { score: null, level: "unknown", confidence: "none", components: {}, recommendationKeys: [] };
  }

  const weightSum = [...present.keys()].reduce((sum, name) => sum + STRESS_WEIGHTS[name], 0);
  const components: StressEstimate["components"] = {};
  let weighted = 0;
  for (const [name, detail] of present) {
    const weight = STRESS_WEIGHTS[name] / weightSum;
    components[name] = { value: detail.value, weight, mean: detail.mean };
    weighted += detail.value * weight;
  }

  const score = clampScore(weighted);
  const ranked = [...present.entries()]
    .sort((a, b) => b[1].value * (STRESS_WEIGHTS[b[0]] / weightSum) - a[1].value * (STRESS_WEIGHTS[a[0]] / weightSum))
    .map(([name]) => name);

  return {
    score,
    level: levelFromScore(score),
    confidence: confidenceFor([...present.keys()], Boolean(input.staleSingleSource)),
    components,
    recommendationKeys: recommendationKeys(ranked, input.followThrough),
  };
}

export interface DatedScore {
  localDate: string;
  score: number | null;
  level: StressLevel;
}

/** True when the last three consecutive local dates are each elevated or high. */
export function hasThreeDayElevated(days: DatedScore[], endDate: string): boolean {
  const byDate = new Map(days.map((day) => [day.localDate, day]));
  let cursor = endDate;
  for (let i = 0; i < 3; i += 1) {
    const day = byDate.get(cursor);
    if (!day || day.score == null || (day.level !== "elevated" && day.level !== "high")) return false;
    cursor = previousLocalDate(cursor);
  }
  return true;
}

/** A streak of length ≥ 2 ended on `localDate` when that day is missed and the prior run is ≥ 2. */
export function streakBrokeOn(completedDates: Iterable<string>, localDate: string): boolean {
  const completed = new Set(completedDates);
  if (completed.has(localDate)) return false;
  let cursor = previousLocalDate(localDate);
  let length = 0;
  while (completed.has(cursor)) {
    length += 1;
    cursor = previousLocalDate(cursor);
  }
  return length >= 2;
}

export function hasStreakHistory(completedDates: Iterable<string>, localDate: string): boolean {
  for (const date of completedDates) {
    if (date && date <= localDate) return true;
  }
  return false;
}

export interface AssembleSources {
  timeZone: string;
  anxietyChecks?: Array<AnxietySignal & { createdAt: string }>;
  journalEntries?: Array<{
    createdAt: string;
    moodBefore: number | null;
    moodAfter: number | null;
    situation?: string | null;
    trigger?: string | null;
    reframe?: string | null;
  }>;
  dailyPlanMood?: number | null;
  sleep?: SleepSignal | null;
  plan?: { requiredCount: number; missedRequired: number } | null;
  intentions?: Array<{
    createdAt: string;
    status: "active" | "done" | "postponed" | "let_go";
    frequency: "once" | "daily" | "selected_days";
    selectedDays: number[];
    completedAt: string | null;
  }>;
  tasks?: Array<{
    createdAt: string;
    status: string;
    postponeCount: number;
  }>;
  planCompletedDates?: Iterable<string>;
  journalWrittenDates?: Iterable<string>;
  journalSentiment?: number | null;
}

function weekdayIndex(localDate: string): number {
  const [year, month, day] = localDate.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

function intentionDueOn(
  intention: NonNullable<AssembleSources["intentions"]>[number],
  localDate: string,
  timeZone: string,
): boolean {
  const created = journalDayKey(intention.createdAt, timeZone);
  if (!created || created > localDate) return false;
  if (intention.frequency === "once") return created === localDate;
  if (intention.frequency === "selected_days") return intention.selectedDays.includes(weekdayIndex(localDate));
  return true;
}

/** Build one local day's scorer input. Grouping uses journalDayKey, not a UTC slice. */
export function assembleStressDay(localDate: string, sources: AssembleSources): StressDayInput {
  const zone = sources.timeZone;
  const checks = (sources.anxietyChecks ?? []).filter(
    (check) => journalDayKey(check.createdAt, zone) === localDate,
  );
  const entries = (sources.journalEntries ?? []).filter(
    (entry) => journalDayKey(entry.createdAt, zone) === localDate,
  );
  const latest = entries[entries.length - 1];

  const dueIntentions = (sources.intentions ?? []).filter((item) => intentionDueOn(item, localDate, zone));
  const intentionMissed = dueIntentions.some((item) => {
    if (item.status === "let_go") return false;
    if (item.status === "done") {
      if (!item.completedAt) return false;
      const completed = journalDayKey(item.completedAt, zone);
      return completed != null && completed > localDate;
    }
    return true;
  });

  const dayTasks = (sources.tasks ?? []).filter(
    (task) => journalDayKey(task.createdAt, zone) === localDate,
  );
  const taskAbandonedOrPostponed = dayTasks.some(
    (task) => task.status === "abandoned" || task.postponeCount > 0,
  );

  const planDates = [...(sources.planCompletedDates ?? [])];
  const journalDates = [...(sources.journalWrittenDates ?? [])];
  const history = hasStreakHistory(planDates, localDate) || hasStreakHistory(journalDates, localDate);

  return {
    anxietyChecks: checks.map(({ intensity, feeling, breathingOffered, breathingCompleted }) => ({
      intensity,
      feeling,
      breathingOffered,
      breathingCompleted,
    })),
    journalMoodAfter: latest?.moodAfter ?? null,
    journalMoodBefore: latest?.moodBefore ?? null,
    dailyPlanMood: sources.dailyPlanMood ?? null,
    sleep: sources.sleep ?? null,
    followThrough: {
      planExists: Boolean(sources.plan),
      requiredCount: sources.plan?.requiredCount ?? 0,
      missedRequired: sources.plan?.missedRequired ?? 0,
      intentionDue: dueIntentions.length > 0,
      intentionMissed,
      taskRelevant: dayTasks.length > 0,
      taskAbandonedOrPostponed,
    },
    streak: {
      hasHistory: history,
      broke: streakBrokeOn(planDates, localDate) || streakBrokeOn(journalDates, localDate),
    },
    journalSentiment: sources.journalSentiment ?? null,
  };
}

/** Consent off, or a cached score for this local day, means no journal text is sent. */
export function journalSentimentRequestAllowed(
  consent: boolean,
  cachedSentiment: number | null | undefined,
): boolean {
  return consent === true && (cachedSentiment == null);
}
