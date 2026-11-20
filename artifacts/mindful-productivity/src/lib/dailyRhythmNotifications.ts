import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  reminderScheduleAt,
  resolveLocalNotificationPermission,
  scheduleVerifiedLocalNotifications,
} from "./localReminderNotifications";
import { isTimeInQuietHours } from "./movementNotifications";
import type { Intention } from "./intentions";

const MOVEMENT_REMINDER_STORAGE_KEY = "mindful_movement_reminder";

function isMovementReminderEnabled(): boolean {
  try {
    const raw = localStorage.getItem(MOVEMENT_REMINDER_STORAGE_KEY);
    if (!raw) return false;
    return Boolean((JSON.parse(raw) as { enabled?: boolean }).enabled);
  } catch {
    return false;
  }
}

export const DAILY_RHYTHM_KIND = "daily_rhythm";
export const DAILY_RHYTHM_TEST_KIND = "daily_rhythm_test";

/** Dedicated ID range — must not collide with movement (42_600_000+) or intention hashes. */
export const DAILY_RHYTHM_BASE_ID = 43_000_000;
export const DAILY_RHYTHM_DAYS = 7;
export const DAILY_RHYTHM_TEST_NOTIFICATION_ID = DAILY_RHYTHM_BASE_ID + 200;
export const DAILY_RHYTHM_TEST_DELAY_MS = 12_000;

export const DEFAULT_QUIET_START = "22:30";
export const DEFAULT_QUIET_END = "07:00";

export type DailyRhythmKey =
  | "morningBoost"
  | "intentionNudge"
  | "movementBreak"
  | "breathingReset"
  | "eveningJournal"
  | "sleepWindDown";

export const DAILY_RHYTHM_KEYS: readonly DailyRhythmKey[] = [
  "morningBoost",
  "intentionNudge",
  "movementBreak",
  "breathingReset",
  "eveningJournal",
  "sleepWindDown",
] as const;

export interface DailyRhythmReminderDefaults {
  time: string;
  path: string;
}

export const DAILY_RHYTHM_DEFAULTS: Record<DailyRhythmKey, DailyRhythmReminderDefaults> = {
  morningBoost: { time: "07:30", path: "/daily-plan" },
  intentionNudge: { time: "09:00", path: "/practice?tab=intentions" },
  movementBreak: { time: "14:00", path: "/practice" },
  breathingReset: { time: "16:30", path: "/focus" },
  eveningJournal: { time: "20:00", path: "/practice?tab=journal" },
  sleepWindDown: { time: "21:30", path: "/sleep" },
};

export interface DailyRhythmReminderState {
  enabled: boolean;
  time: string;
}

export interface DailyRhythmConfig {
  masterEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  reminders: Record<DailyRhythmKey, DailyRhythmReminderState>;
  /** User finished the first-run sheet (Turn on / Not now). */
  promptCompleted: boolean;
  /** ISO timestamp of last permission denial — re-prompt at most once per 7 days. */
  lastDeniedPromptAt: string | null;
}

export const DAILY_RHYTHM_STORAGE_KEY = "kindease_daily_rhythm_v1";

export function defaultDailyRhythmConfig(): DailyRhythmConfig {
  return {
    masterEnabled: false,
    quietStart: DEFAULT_QUIET_START,
    quietEnd: DEFAULT_QUIET_END,
    reminders: {
      morningBoost: { enabled: true, time: DAILY_RHYTHM_DEFAULTS.morningBoost.time },
      intentionNudge: { enabled: true, time: DAILY_RHYTHM_DEFAULTS.intentionNudge.time },
      movementBreak: { enabled: true, time: DAILY_RHYTHM_DEFAULTS.movementBreak.time },
      breathingReset: { enabled: true, time: DAILY_RHYTHM_DEFAULTS.breathingReset.time },
      eveningJournal: { enabled: true, time: DAILY_RHYTHM_DEFAULTS.eveningJournal.time },
      sleepWindDown: { enabled: true, time: DAILY_RHYTHM_DEFAULTS.sleepWindDown.time },
    },
    promptCompleted: false,
    lastDeniedPromptAt: null,
  };
}

export function loadDailyRhythmConfig(): DailyRhythmConfig {
  const base = defaultDailyRhythmConfig();
  try {
    const raw = localStorage.getItem(DAILY_RHYTHM_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<DailyRhythmConfig>;
    const reminders = { ...base.reminders };
    for (const key of DAILY_RHYTHM_KEYS) {
      const incoming = parsed.reminders?.[key];
      if (incoming) {
        reminders[key] = {
          enabled: incoming.enabled !== false,
          time: normalizeHhMm(incoming.time) ?? base.reminders[key].time,
        };
      }
    }
    return {
      masterEnabled: Boolean(parsed.masterEnabled),
      quietStart: normalizeHhMm(parsed.quietStart) ?? base.quietStart,
      quietEnd: normalizeHhMm(parsed.quietEnd) ?? base.quietEnd,
      reminders,
      promptCompleted: Boolean(parsed.promptCompleted),
      lastDeniedPromptAt:
        typeof parsed.lastDeniedPromptAt === "string" ? parsed.lastDeniedPromptAt : null,
    };
  } catch {
    return base;
  }
}

export function saveDailyRhythmConfig(config: DailyRhythmConfig): void {
  try {
    localStorage.setItem(DAILY_RHYTHM_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // storage denied
  }
}

/** Accept "HH:MM" or "HH:MM:SS" (wellness prefs). */
export function normalizeHhMm(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function applyPreferredMorningBoostTime(
  config: DailyRhythmConfig,
  preferredReminderTime: string | null | undefined,
): DailyRhythmConfig {
  const time = normalizeHhMm(preferredReminderTime);
  if (!time) return config;
  return {
    ...config,
    reminders: {
      ...config.reminders,
      morningBoost: { ...config.reminders.morningBoost, time },
    },
  };
}

export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export function pickRotatingMessage(messages: string[], date: Date): string {
  if (messages.length === 0) return "";
  return messages[dayOfYear(date) % messages.length]!;
}

export function dailyRhythmNotificationId(key: DailyRhythmKey, dayOffset: number): number {
  const typeIndex = DAILY_RHYTHM_KEYS.indexOf(key);
  return DAILY_RHYTHM_BASE_ID + typeIndex * DAILY_RHYTHM_DAYS + dayOffset;
}

export function allDailyRhythmNotificationIds(): number[] {
  const ids: number[] = [];
  for (const key of DAILY_RHYTHM_KEYS) {
    for (let day = 0; day < DAILY_RHYTHM_DAYS; day++) {
      ids.push(dailyRhythmNotificationId(key, day));
    }
  }
  ids.push(DAILY_RHYTHM_TEST_NOTIFICATION_ID);
  return ids;
}

export function isDailyRhythmNotificationExtra(extra: unknown): boolean {
  if (!extra || typeof extra !== "object") return false;
  const kind = (extra as { kind?: unknown }).kind;
  return kind === DAILY_RHYTHM_KIND || kind === DAILY_RHYTHM_TEST_KIND;
}

/**
 * Any local notification with a safe in-app `extra.path` may navigate there.
 * Rejects absolute URLs and auth callbacks.
 */
export function pathFromNotificationExtra(extra: unknown): string | null {
  if (!extra || typeof extra !== "object") return null;
  const path = (extra as { path?: unknown }).path;
  if (typeof path !== "string" || !path.startsWith("/")) return null;
  if (path.startsWith("//") || path.includes("://")) return null;
  if (path.startsWith("/auth") || path.startsWith("/reset-password")) return null;
  return path;
}

export function hasActiveIntentionReminderToday(
  intentions: Intention[],
  now = new Date(),
): boolean {
  const weekday = now.getDay(); // 0=Sun
  return intentions.some((intention) => {
    if (intention.status !== "active") return false;
    if (intention.reminder_choice === "off" || !intention.reminder_time) return false;
    if (intention.frequency === "daily" || intention.frequency === "once") return true;
    if (intention.frequency === "selected_days") {
      return intention.selected_days.includes(weekday);
    }
    return true;
  });
}

export function shouldSkipReminder(
  key: DailyRhythmKey,
  options: {
    movementEnabled: boolean;
    hasIntentionReminderToday: boolean;
  },
): boolean {
  if (key === "movementBreak" && options.movementEnabled) return true;
  if (key === "intentionNudge" && options.hasIntentionReminderToday) return true;
  return false;
}

function timeParts(value: string): { hour: number; minute: number } {
  const normalized = normalizeHhMm(value) ?? "09:00";
  const [hour, minute] = normalized.split(":").map(Number);
  return { hour, minute };
}

/** Next `count` future occurrences of hour:minute (local), starting today if still ahead. */
export function nextOccurrences(hour: number, minute: number, count: number, now = new Date()): Date[] {
  const results: Date[] = [];
  for (let offset = 0; results.length < count && offset < count + 2; offset++) {
    const date = new Date(now);
    date.setSeconds(0, 0);
    date.setMilliseconds(0);
    date.setDate(now.getDate() + offset);
    date.setHours(hour, minute, 0, 0);
    if (date.getTime() <= now.getTime()) continue;
    results.push(date);
  }
  return results;
}

export type DailyRhythmCopy = {
  title: string;
  bodies: Record<DailyRhythmKey, string[]>;
};

export async function cancelDailyRhythmReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.cancel({
    notifications: allDailyRhythmNotificationIds().map((id) => ({ id })),
  });
}

export interface ScheduleDailyRhythmOptions {
  config: DailyRhythmConfig;
  copy: DailyRhythmCopy;
  requestPermission?: boolean;
  intentions?: Intention[];
  preferredMorningTime?: string | null;
  /** Override movement enabled detection (tests). */
  movementEnabled?: boolean;
  now?: Date;
}

export async function scheduleDailyRhythmReminders(
  options: ScheduleDailyRhythmOptions,
): Promise<boolean> {
  await cancelDailyRhythmReminders();

  let config = options.config;
  if (options.preferredMorningTime) {
    config = applyPreferredMorningBoostTime(config, options.preferredMorningTime);
  }

  if (!Capacitor.isNativePlatform() || !config.masterEnabled) {
    return false;
  }

  const permission = await resolveLocalNotificationPermission(
    options.requestPermission ?? false,
  );
  if (permission !== "granted") return false;

  const movementEnabled =
    options.movementEnabled ?? isMovementReminderEnabled();
  const hasIntention = hasActiveIntentionReminderToday(
    options.intentions ?? [],
    options.now,
  );
  const now = options.now ?? new Date();
  const scheduled: Array<{
    id: number;
    title: string;
    body: string;
    extra: Record<string, unknown>;
    schedule: ReturnType<typeof reminderScheduleAt>;
  }> = [];

  for (const key of DAILY_RHYTHM_KEYS) {
    const reminder = config.reminders[key];
    if (!reminder.enabled) continue;
    if (shouldSkipReminder(key, { movementEnabled, hasIntentionReminderToday: hasIntention })) {
      continue;
    }
    if (isTimeInQuietHours(reminder.time, config.quietStart, config.quietEnd)) {
      continue;
    }

    const { hour, minute } = timeParts(reminder.time);
    const occurrences = nextOccurrences(hour, minute, DAILY_RHYTHM_DAYS, now);
    const bodies = options.copy.bodies[key] ?? [];
    const path = DAILY_RHYTHM_DEFAULTS[key].path;

    occurrences.forEach((at, dayOffset) => {
      scheduled.push({
        id: dailyRhythmNotificationId(key, dayOffset),
        title: options.copy.title,
        body: pickRotatingMessage(bodies, at),
        extra: {
          kind: DAILY_RHYTHM_KIND,
          rhythmKey: key,
          path,
        },
        schedule: reminderScheduleAt(at),
      });
    });
  }

  if (scheduled.length === 0) return true;
  return scheduleVerifiedLocalNotifications(scheduled);
}

export async function scheduleDailyRhythmTestNotification(
  copy: { title: string; body: string },
  path = "/daily-plan",
  requestPermission = true,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const permission = await resolveLocalNotificationPermission(requestPermission);
  if (permission !== "granted") return false;
  await LocalNotifications.cancel({
    notifications: [{ id: DAILY_RHYTHM_TEST_NOTIFICATION_ID }],
  });
  return scheduleVerifiedLocalNotifications([
    {
      id: DAILY_RHYTHM_TEST_NOTIFICATION_ID,
      title: copy.title,
      body: copy.body,
      extra: { kind: DAILY_RHYTHM_TEST_KIND, path },
      schedule: reminderScheduleAt(new Date(Date.now() + DAILY_RHYTHM_TEST_DELAY_MS)),
    },
  ]);
}

export function canShowDailyRhythmPrompt(
  config: DailyRhythmConfig,
  now = new Date(),
): boolean {
  if (config.promptCompleted) return false;
  if (!config.lastDeniedPromptAt) return true;
  const last = Date.parse(config.lastDeniedPromptAt);
  if (Number.isNaN(last)) return true;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return now.getTime() - last >= sevenDaysMs;
}

/** Built-in rotating bodies (EN). Callers pass localized copy from translations. */
export const DAILY_RHYTHM_BODIES_EN: Record<DailyRhythmKey, string[]> = {
  morningBoost: [
    "Good morning 🌿 One small step today is enough. See your plan.",
    "A calm start makes a kinder day. Ready for today?",
    "You showed up again. That matters. 💚",
  ],
  intentionNudge: [
    "What do you want to hold onto today? Set a gentle intention.",
  ],
  movementBreak: [
    "Time to stretch for 5 minutes. Your body will thank you.",
    "Stand up, roll your shoulders, breathe. Quick break?",
  ],
  breathingReset: [
    "Feeling busy? Take 1 minute to breathe with KindEase.",
  ],
  eveningJournal: [
    "How was your day? Write one thing you're grateful for.",
  ],
  sleepWindDown: [
    "Time to wind down 🌙 Your sleep routine is ready.",
    "Screens off soon. A calm night starts now.",
  ],
};
