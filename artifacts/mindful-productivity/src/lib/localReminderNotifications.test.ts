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
  MINDFUL_REMINDER_CHANNEL_ID,
  scheduleVerifiedLocalNotifications,
} from "./localReminderNotifications";
import {
  MOVEMENT_NOTIFICATION_BASE_ID,
  MOVEMENT_TEST_DELAY_MS,
  MOVEMENT_TEST_NOTIFICATION_ID,
  cancelMovementReminders,
  scheduleMovementReminder,
  scheduleMovementTestNotification,
} from "./movementNotifications";

function mockPendingFromSchedule() {
  notifications.schedule.mockImplementation(async ({ notifications: list }) => {
    notifications.getPending.mockResolvedValue({ notifications: list });
    return { notifications: list };
  });
}

describe("verified local reminder scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifications.cancel.mockResolvedValue(undefined);
    notifications.createChannel.mockResolvedValue(undefined);
    notifications.getPending.mockResolvedValue({ notifications: [] });
    notifications.checkPermissions.mockResolvedValue({ display: "granted" });
    notifications.requestPermissions.mockResolvedValue({ display: "granted" });
    mockPendingFromSchedule();
  });

  it("creates the Mindful Space channel and verifies pending IDs", async () => {
    const ok = await scheduleVerifiedLocalNotifications([
      { id: 11, title: "T", body: "B" },
    ]);
    expect(ok).toBe(true);
    expect(notifications.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MINDFUL_REMINDER_CHANNEL_ID,
        importance: 4,
        vibration: true,
        sound: "default",
      }),
    );
    expect(notifications.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: 11,
          channelId: MINDFUL_REMINDER_CHANNEL_ID,
        }),
      ],
    });
    expect(notifications.getPending).toHaveBeenCalled();
  });

  it("returns false when getPending does not include the scheduled ID", async () => {
    notifications.schedule.mockResolvedValue({ notifications: [{ id: 11 }] });
    notifications.getPending.mockResolvedValue({ notifications: [] });
    await expect(scheduleVerifiedLocalNotifications([
      { id: 11, title: "T", body: "B" },
    ])).resolves.toBe(false);
  });
});

describe("movement local notifications", () => {
  const config = {
    enabled: true,
    time: "10:00",
    days: [1, 3],
    quietStart: "22:00",
    quietEnd: "08:00",
  };
  const copy = { title: "Movement time!", body: "Time to stretch" };

  beforeEach(() => {
    vi.clearAllMocks();
    notifications.cancel.mockResolvedValue(undefined);
    notifications.createChannel.mockResolvedValue(undefined);
    notifications.checkPermissions.mockResolvedValue({ display: "granted" });
    notifications.requestPermissions.mockResolvedValue({ display: "granted" });
    mockPendingFromSchedule();
  });

  it("schedules weekday local notifications and verifies pending entries", async () => {
    const ok = await scheduleMovementReminder(config, copy, false);
    expect(ok).toBe(true);
    expect(notifications.requestPermissions).not.toHaveBeenCalled();
    expect(notifications.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: MOVEMENT_NOTIFICATION_BASE_ID,
          extra: { kind: "movement" },
          schedule: { on: { weekday: 2, hour: 10, minute: 0 }, allowWhileIdle: true },
        }),
        expect.objectContaining({
          id: MOVEMENT_NOTIFICATION_BASE_ID + 1,
          schedule: { on: { weekday: 4, hour: 10, minute: 0 }, allowWhileIdle: true },
        }),
      ],
    });
  });

  it("cancels movement reminders when disabled", async () => {
    const ok = await scheduleMovementReminder({ ...config, enabled: false }, copy);
    expect(ok).toBe(false);
    expect(notifications.cancel).toHaveBeenCalled();
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it("does not schedule when the reminder time is inside quiet hours", async () => {
    const ok = await scheduleMovementReminder({
      ...config,
      time: "23:00",
    }, copy);
    expect(ok).toBe(true);
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it("schedules a test notification about 12 seconds later", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T08:00:00"));
    const ok = await scheduleMovementTestNotification(copy, true);
    expect(ok).toBe(true);
    expect(notifications.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: MOVEMENT_TEST_NOTIFICATION_ID,
          extra: { kind: "movement_test" },
          schedule: {
            at: new Date(Date.now() + MOVEMENT_TEST_DELAY_MS),
            allowWhileIdle: true,
          },
        }),
      ],
    });
    vi.useRealTimers();
  });

  it("returns false and leaves the reminder unscheduled when permission is denied", async () => {
    notifications.checkPermissions.mockResolvedValue({ display: "denied" });
    notifications.requestPermissions.mockResolvedValue({ display: "denied" });
    const ok = await scheduleMovementReminder(config, copy, true);
    expect(ok).toBe(false);
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it("cancelMovementReminders targets movement ids only", async () => {
    await cancelMovementReminders();
    expect(notifications.cancel).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        { id: MOVEMENT_NOTIFICATION_BASE_ID },
        { id: MOVEMENT_TEST_NOTIFICATION_ID },
      ]),
    });
  });
});
