export const PRIMARY_GOALS = [
  "stress",
  "sleep",
  "focus",
  "motivation",
  "self_compassion",
  "habit",
] as const;

export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

export const PREFERRED_DURATIONS = [3, 5, 10, 15] as const;
export type PreferredDurationMinutes = (typeof PREFERRED_DURATIONS)[number];

export const WELLNESS_LOCALES = ["en", "id", "ja"] as const;
export type WellnessLocale = (typeof WELLNESS_LOCALES)[number];

export const PROGRAM_SLUGS = ["calm-reset", "better-sleep", "focus-habit"] as const;
export type ProgramSlug = (typeof PROGRAM_SLUGS)[number];

export const ENROLLMENT_STATUSES = ["active", "completed", "abandoned"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const DAILY_PLAN_ITEM_TYPES = [
  "mood_checkin",
  "daily_insight",
  "program_practice",
  "reflection",
] as const;
export type DailyPlanItemType = (typeof DAILY_PLAN_ITEM_TYPES)[number];

export const DAILY_PLAN_ITEM_KEYS = [
  "mood_checkin",
  "daily_insight",
  "program_practice",
  "reflection",
] as const;
export type DailyPlanItemKey = (typeof DAILY_PLAN_ITEM_KEYS)[number];

export const PRACTICE_KINDS = [
  "breathing",
  "relaxation",
  "focus_timer",
  "sleep_routine",
  "movement",
] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

export const DAILY_PLAN_VERSION = 1 as const;
export type DailyPlanVersion = typeof DAILY_PLAN_VERSION;

export interface WellnessPreferences {
  user_id: string;
  primary_goal: PrimaryGoal;
  preferred_duration_minutes: PreferredDurationMinutes;
  preferred_reminder_time: string;
  timezone: string;
  locale: WellnessLocale;
  created_at: string;
  updated_at: string;
}

export interface WellnessPreferencesInput {
  primary_goal: PrimaryGoal;
  preferred_duration_minutes: PreferredDurationMinutes;
  preferred_reminder_time: string;
  timezone: string;
  locale: WellnessLocale;
}

export interface ProgramEnrollment {
  id: string;
  user_id: string;
  program_slug: ProgramSlug;
  status: EnrollmentStatus;
  current_day: number;
  started_on: string;
  completed_on: string | null;
  created_at: string;
  updated_at: string;
}

export type DailyPlanItem =
  | {
      item_key: Exclude<DailyPlanItemKey, "program_practice">;
      item_type: Exclude<DailyPlanItemType, "program_practice">;
      required: boolean;
      planned_minutes: number;
      practice_kind?: null;
      practice_content_key?: string;
      reflection_content_key?: string;
    }
  | {
      item_key: "program_practice";
      item_type: "program_practice";
      required: boolean;
      planned_minutes: number;
      practice_kind: PracticeKind;
      practice_content_key?: string;
      reflection_content_key?: string;
    };

export interface DailyPlanSnapshot {
  id: string;
  user_id: string;
  local_date: string;
  enrollment_id: string | null;
  program_slug: ProgramSlug | null;
  program_day: number | null;
  primary_goal: PrimaryGoal;
  plan_version: DailyPlanVersion;
  lesson_id: string | null;
  items: DailyPlanItem[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyPlanSnapshotDraft {
  local_date: string;
  enrollment_id: string | null;
  program_slug: ProgramSlug | null;
  program_day: number | null;
  primary_goal: PrimaryGoal;
  plan_version: DailyPlanVersion;
  lesson_id: string | null;
  items: DailyPlanItem[];
  completed_at: null;
}

export interface DailyActivity {
  id: string;
  user_id: string;
  daily_plan_id: string;
  local_date: string;
  item_key: DailyPlanItemKey;
  item_type: DailyPlanItemType;
  practice_kind: PracticeKind | null;
  duration_minutes: number | null;
  mood_score: number | null;
  reflection_text: string | null;
  completed_at: string;
  created_at: string;
}

export interface DailyActivityInput {
  daily_plan_id: string;
  local_date: string;
  item_key: DailyPlanItemKey;
  item_type: DailyPlanItemType;
  practice_kind?: PracticeKind | null;
  duration_minutes?: number | null;
  mood_score?: number | null;
  reflection_text?: string | null;
}

export function isPrimaryGoal(value: unknown): value is PrimaryGoal {
  return typeof value === "string" && (PRIMARY_GOALS as readonly string[]).includes(value);
}

export function isProgramSlug(value: unknown): value is ProgramSlug {
  return typeof value === "string" && (PROGRAM_SLUGS as readonly string[]).includes(value);
}
