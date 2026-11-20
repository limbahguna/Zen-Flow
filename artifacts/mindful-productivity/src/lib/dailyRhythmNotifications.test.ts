import { beforeEach, describe, expect, it, vi } from "vitest";

const notifications = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  getPending: vi.fn(),
  createChannel: vi.fn(),
  removeAllDeliveredNotifications: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: notifications,
}));

import {
  DAILY_RHYTHM_BASE_ID,
  DAILY_RHYTHM_KIND,
  DAILY_RHYTHM_TEST_NOTIFICATION_ID,
  DEFAULT_QUIET_END,
  DEFAULT_QUIET_START,
  applyPreferredMorningBoostTime,
  canShowDailyRhythmPrompt,
  cancelDailyRhythmReminders,
  dailyRhythmNotificationId,
  defaultDailyRhythmConfig,
  hasActiveIntentionReminderToday,
  nextOccurrences,
  pathFromNotificationExtra,
  pickRotatingMessage,
  scheduleDailyRhythmReminders,
  shouldSkipReminder,
  type DailyRhythmCopy,
} from "./dailyRhythmNotifications";
import { MOVEMENT_NOTIFICATION_BASE_ID } from "./movementNotifications";
import type { Intention } from "./intentions";
import { MINDFUL_REMINDER_CHANNEL_ID } from "./localReminderNotifications";

const copy: DailyRhythmCopy = {
  title: "KindEase",
  bodies: {
    morningBoost: ["Morning A", "Morning B", "Morning C"],
    intentionNudge: ["Intention A"],
    movementBreak: ["Move A", "Move B"],
    breathingReset: ["Breathe A"],
    eveningJournal: ["Journal A"],
    sleepWindDown: ["Sleep A", "Sleep B"],
  },
};

function mockPendingFromSchedule() {
  notifications.schedule.mockImplementation(async ({ notifications: list }) => {
    notifications.getPending.mockResolvedValue({ notifications: list });
    return { notifications: list };
  });
}

const sampleIntention: Intention = {
  id: "int-1",
  user_id: "u1",
  title: "Practice",
  why_it_matters: null,
  small_action: "10 minutes",
  status: "active",
  reminder_choice: "morning",
  reminder_time: "09:00:00",
  frequency: "daily",
  selected_days: [],
  timezone: "Asia/Jakarta",
  postponed_until: null,
  completed_at: null,
  let_go_at: null,
  created_at: "2026-09-07T00:00:00Z",
  updated_at: "2026-09-07T00:00:00Z",
};

describe("daily rhythm helpers", () => {
  it("picks rotating copy by day-of-year", () => {
    expect(pickRotatingMessage(["a", "b", "c"], new Date("2026-01-01T12:00:00"))).toBe(
      pickRotatingMessage(["a", "b", "c"], new Date("2026-01-01T18:00:00")),
    );
    expect(pickRotatingMessage(["a", "b"], new Date("2026-01-02T08:00:00"))).not.toBe(
      pickRotatingMessage(["a", "b"], new Date("2026-01-01T08:00:00")),
    );
  });

  it("routes any safe extra.path", () => {
    expect(pathFromNotificationExtra({ path: "/daily-plan" })).toBe("/daily-plan");
    expect(pathFromNotificationExtra({ path: "/practice?tab=journal" })).toBe(
      "/practice?tab=journal",
    );
    expect(pathFromNotificationExtra({ path: "/auth?code=x" })).toBeNull();
    expect(pathFromNotificationExtra({ path: "https://evil.test" })).toBeNull();
    expect(pathFromNotificationExtra(null)).toBeNull();
  });

  it("uses preferred reminder time for morningBoost", () => {
    const config = applyPreferredMorningBoostTime(
      defaultDailyRhythmConfig(),
      "08:15:00",
    );
    expect(config.reminders.morningBoost.time).toBe("08:15");
  });

  it("skips movementBreak when movement reminder is on, and intention when already reminded", () => {
    expect(
      shouldSkipReminder("movementBreak", {
        movementEnabled: true,
        hasIntentionReminderToday: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipReminder("intentionNudge", {
        movementEnabled: false,
        hasIntentionReminderToday: true,
      }),
    ).toBe(true);
    expect(
      shouldSkipReminder("breathingReset", {
        movementEnabled: true,
        hasIntentionReminderToday: true,
      }),
    ).toBe(false);
  });

  it("detects an active intention reminder for today", () => {
    expect(hasActiveIntentionReminderToday([sampleIntention])).toBe(true);
    expect(
      hasActiveIntentionReminderToday([
        { ...sampleIntention, reminder_choice: "off", reminder_time: null },
      ]),
    ).toBe(false);
  });

  it("gates the first-run prompt after a denial for 7 days", () => {
    const base = defaultDailyRhythmConfig();
    expect(canShowDailyRhythmPrompt(base)).toBe(true);
    expect(
      canShowDailyRhythmPrompt({
        ...base,
        lastDeniedPromptAt: new Date("2026-11-18T10:00:00Z").toISOString(),
      }, new Date("2026-11-20T10:00:00Z")),
    ).toBe(false);
    expect(
      canShowDailyRhythmPrompt({
        ...base,
        lastDeniedPromptAt: new Date("2026-11-10T10:00:00Z").toISOString(),
      }, new Date("2026-11-20T10:00:00Z")),
    ).toBe(true);
    expect(
      canShowDailyRhythmPrompt({ ...base, promptCompleted: true }),
    ).toBe(false);
  });

  it("keeps daily-rhythm IDs outside the movement range", () => {
    expect(DAILY_RHYTHM_BASE_ID).toBeGreaterThan(MOVEMENT_NOTIFICATION_BASE_ID + 20);
    expect(dailyRhythmNotificationId("morningBoost", 0)).toBe(DAILY_RHYTHM_BASE_ID);
    expect(DAILY_RHYTHM_TEST_NOTIFICATION_ID).not.toBe(MOVEMENT_NOTIFICATION_BASE_ID);
  });
});

describe("scheduleDailyRhythmReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifications.cancel.mockResolvedValue(undefined);
    notifications.createChannel.mockResolvedValue(undefined);
    notifications.checkPermissions.mockResolvedValue({ display: "granted" });
    notifications.requestPermissions.mockResolvedValue({ display: "granted" });
    mockPendingFromSchedule();
    localStorage.clear();
  });

  it("schedules defaults after permission and verifies pending IDs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T08:00:00"));
    const config = {
      ...defaultDailyRhythmConfig(),
      masterEnabled: true,
      quietStart: DEFAULT_QUIET_START,
      quietEnd: DEFAULT_QUIET_END,
    };
    const ok = await scheduleDailyRhythmReminders({
      config,
      copy,
      requestPermission: false,
      movementEnabled: false,
      intentions: [],
    });
    expect(ok).toBe(true);
    expect(notifications.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: MINDFUL_REMINDER_CHANNEL_ID }),
    );
    expect(notifications.schedule).toHaveBeenCalled();
    const scheduled = notifications.schedule.mock.calls[0][0].notifications;
    expect(scheduled.length).toBeGreaterThan(0);
    expect(scheduled.every((item: { extra: { kind: string; path: string } }) =>
      item.extra.kind === DAILY_RHYTHM_KIND && item.extra.path.startsWith("/"),
    )).toBe(true);
    expect(scheduled.some((item: { extra: { path: string } }) =>
      item.extra.path === "/daily-plan",
    )).toBe(true);
    vi.useRealTimers();
  });

  it("skips reminders whose time falls inside quiet hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T08:00:00"));
    const config = defaultDailyRhythmConfig();
    config.masterEnabled = true;
    config.quietStart = "07:00";
    config.quietEnd = "22:00";
    // Every default time is inside 07:00–22:00, so nothing schedules.
    const ok = await scheduleDailyRhythmReminders({
      config,
      copy,
      movementEnabled: false,
    });
    expect(ok).toBe(true);
    expect(notifications.schedule).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not cancel movement reminder IDs", async () => {
    const config = { ...defaultDailyRhythmConfig(), masterEnabled: false };
    await scheduleDailyRhythmReminders({ config, copy });
    const cancelled = notifications.cancel.mock.calls[0][0].notifications as Array<{ id: number }>;
    expect(cancelled.every((item) => item.id >= DAILY_RHYTHM_BASE_ID)).toBe(true);
    expect(cancelled.some((item) => item.id === MOVEMENT_NOTIFICATION_BASE_ID)).toBe(false);
  });

  it("respects per-reminder toggles", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T08:00:00"));
    const config = defaultDailyRhythmConfig();
    config.masterEnabled = true;
    for (const key of Object.keys(config.reminders) as Array<keyof typeof config.reminders>) {
      config.reminders[key].enabled = key === "breathingReset";
    }
    await scheduleDailyRhythmReminders({
      config,
      copy,
      movementEnabled: false,
    });
    const scheduled = notifications.schedule.mock.calls[0][0].notifications;
    expect(
      scheduled.every((item: { extra: { rhythmKey: string } }) =>
        item.extra.rhythmKey === "breathingReset",
      ),
    ).toBe(true);
    vi.useRealTimers();
  });

  it("skips intentionNudge when an intention reminder already exists", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T08:00:00"));
    const config = defaultDailyRhythmConfig();
    config.masterEnabled = true;
    await scheduleDailyRhythmReminders({
      config,
      copy,
      intentions: [sampleIntention],
      movementEnabled: false,
    });
    const scheduled = notifications.schedule.mock.calls[0][0].notifications;
    expect(
      scheduled.some((item: { extra: { rhythmKey: string } }) =>
        item.extra.rhythmKey === "intentionNudge",
      ),
    ).toBe(false);
    vi.useRealTimers();
  });

  it("leaves nothing scheduled when permission is denied", async () => {
    notifications.checkPermissions.mockResolvedValue({ display: "denied" });
    notifications.requestPermissions.mockResolvedValue({ display: "denied" });
    const config = { ...defaultDailyRhythmConfig(), masterEnabled: true };
    const ok = await scheduleDailyRhythmReminders({
      config,
      copy,
      requestPermission: true,
    });
    expect(ok).toBe(false);
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it("cancelDailyRhythmReminders only targets daily-rhythm IDs", async () => {
    await cancelDailyRhythmReminders();
    const cancelled = notifications.cancel.mock.calls[0][0].notifications as Array<{ id: number }>;
    expect(cancelled).toEqual(
      expect.arrayContaining([
        { id: DAILY_RHYTHM_BASE_ID },
        { id: DAILY_RHYTHM_TEST_NOTIFICATION_ID },
      ]),
    );
    expect(cancelled.some((item) => item.id === MOVEMENT_NOTIFICATION_BASE_ID)).toBe(false);
  });

  it("nextOccurrences returns future local times only", () => {
    const now = new Date("2026-11-20T10:00:00");
    const times = nextOccurrences(9, 0, 3, now);
    expect(times).toHaveLength(3);
    expect(times[0]!.getTime()).toBeGreaterThan(now.getTime());
    expect(times[0]!.getHours()).toBe(9);
  });
});
