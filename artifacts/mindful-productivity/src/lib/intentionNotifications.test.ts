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
  cancelIntentionReminder,
  clearDeviceIntentionNotifications,
  intentionNotificationBaseId,
  intentionPathFromNotificationExtra,
  scheduleIntentionReminder,
} from "./intentionNotifications";
import type { Intention } from "./intentions";
import { MINDFUL_REMINDER_CHANNEL_ID } from "./localReminderNotifications";
import { MOVEMENT_NOTIFICATION_BASE_ID } from "./movementNotifications";

const intention: Intention = {
  id: "51cb0645-82d0-4a31-b12c-3f2922f57573",
  user_id: "owner-a",
  title: "Learn Japanese",
  why_it_matters: null,
  small_action: "Practice Japanese for 10 minutes",
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

describe("intention local notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifications.cancel.mockResolvedValue(undefined);
    notifications.createChannel.mockResolvedValue(undefined);
    notifications.checkPermissions.mockResolvedValue({ display: "prompt" });
    notifications.requestPermissions.mockResolvedValue({ display: "granted" });
    notifications.schedule.mockImplementation(async ({ notifications: list }) => {
      notifications.getPending.mockResolvedValue({ notifications: list });
      return { notifications: list };
    });
    notifications.getPending.mockResolvedValue({ notifications: [] });
  });

  it("uses deterministic IDs and cancels every possible schedule slot", async () => {
    expect(intentionNotificationBaseId(intention.id)).toBe(
      intentionNotificationBaseId(intention.id),
    );
    await cancelIntentionReminder(intention.id);
    expect(notifications.cancel).toHaveBeenCalledWith({
      notifications: expect.arrayContaining([
        { id: intentionNotificationBaseId(intention.id) },
        { id: intentionNotificationBaseId(intention.id) + 6 },
      ]),
    });
  });

  it("requests permission only during an explicit enabled-reminder save", async () => {
    await scheduleIntentionReminder(intention, false);
    expect(notifications.requestPermissions).not.toHaveBeenCalled();
    expect(notifications.schedule).not.toHaveBeenCalled();

    await scheduleIntentionReminder(intention, true);
    expect(notifications.requestPermissions).toHaveBeenCalledOnce();
    expect(notifications.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          body: "Practice Japanese for 10 minutes",
          channelId: MINDFUL_REMINDER_CHANNEL_ID,
          schedule: { on: { hour: 9, minute: 0 }, allowWhileIdle: true },
          extra: expect.objectContaining({ intentionId: intention.id }),
        }),
      ],
    });
  });

  it("cancels but never schedules a completed intention", async () => {
    await scheduleIntentionReminder({ ...intention, status: "done" });
    expect(notifications.cancel).toHaveBeenCalled();
    expect(notifications.checkPermissions).not.toHaveBeenCalled();
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  it("accepts only intention notification deep links", () => {
    expect(intentionPathFromNotificationExtra({
      path: `/practice?tab=intentions&intention=${intention.id}`,
    })).toBe(`/practice?tab=intentions&intention=${intention.id}`);
    expect(intentionPathFromNotificationExtra({ path: "/auth?code=secret" })).toBeNull();
    expect(intentionPathFromNotificationExtra(null)).toBeNull();
  });

  it("does not cancel movement reminders when clearing intention notifications", async () => {
    notifications.getPending.mockResolvedValue({
      notifications: [
        {
          id: 1,
          extra: {
            intentionId: intention.id,
            path: `/practice?tab=intentions&intention=${intention.id}`,
          },
        },
        { id: MOVEMENT_NOTIFICATION_BASE_ID, extra: { kind: "movement" } },
      ],
    });
    await clearDeviceIntentionNotifications();
    expect(notifications.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 1 }],
    });
    expect(notifications.removeAllDeliveredNotifications).not.toHaveBeenCalled();
  });
});
