import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  reminderScheduleAt,
  reminderScheduleOn,
  resolveLocalNotificationPermission,
  scheduleVerifiedLocalNotifications,
} from "./localReminderNotifications";

export interface MovementReminderInput {
  enabled: boolean;
  time: string;
  days: number[];
  quietStart: string;
  quietEnd: string;
}

export interface MovementNotificationCopy {
  title: string;
  body: string;
}

export const MOVEMENT_KIND = "movement";
export const MOVEMENT_TEST_KIND = "movement_test";
export const MOVEMENT_SNOOZE_KIND = "movement_snooze";
export const MOVEMENT_NOTIFICATION_BASE_ID = 42_600_000;
export const MOVEMENT_TEST_NOTIFICATION_ID = MOVEMENT_NOTIFICATION_BASE_ID + 8;
export const MOVEMENT_SNOOZE_NOTIFICATION_ID = MOVEMENT_NOTIFICATION_BASE_ID + 9;
export const MOVEMENT_TEST_DELAY_MS = 12_000;

const MOVEMENT_SLOT_COUNT = 7;

export function isTimeInQuietHours(
  time: string,
  quietStart: string,
  quietEnd: string,
): boolean {
  const hhmm = (value: string) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + (minute || 0);
  };
  const current = hhmm(time);
  const start = hhmm(quietStart);
  const end = hhmm(quietEnd);
  if (start <= end) return current >= start && current < end;
  return current >= start || current < end;
}

function timeParts(value: string) {
  const [hour = "10", minute = "0"] = value.split(":");
  return { hour: Number(hour), minute: Number(minute) };
}

export function isMovementNotificationExtra(extra: unknown): boolean {
  if (!extra || typeof extra !== "object") return false;
  const kind = (extra as { kind?: unknown }).kind;
  return kind === MOVEMENT_KIND || kind === MOVEMENT_TEST_KIND || kind === MOVEMENT_SNOOZE_KIND;
}

export async function cancelMovementReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const ids = [
    ...Array.from({ length: MOVEMENT_SLOT_COUNT }, (_, index) => ({
      id: MOVEMENT_NOTIFICATION_BASE_ID + index,
    })),
    { id: MOVEMENT_TEST_NOTIFICATION_ID },
    { id: MOVEMENT_SNOOZE_NOTIFICATION_ID },
  ];
  await LocalNotifications.cancel({ notifications: ids });
}

export async function scheduleMovementReminder(
  config: MovementReminderInput,
  notification: MovementNotificationCopy,
  requestPermission = true,
): Promise<boolean> {
  await cancelMovementReminders();
  if (!Capacitor.isNativePlatform() || !config.enabled) {
    return false;
  }
  if (config.days.length === 0) {
    return true;
  }
  if (isTimeInQuietHours(config.time, config.quietStart, config.quietEnd)) {
    return true;
  }

  const permission = await resolveLocalNotificationPermission(requestPermission);
  if (permission !== "granted") return false;

  const { hour, minute } = timeParts(config.time);
  const extra = { kind: MOVEMENT_KIND };
  const scheduled = config.days.map((day, index) => ({
    id: MOVEMENT_NOTIFICATION_BASE_ID + index,
    title: notification.title,
    body: notification.body,
    extra,
    schedule: reminderScheduleOn({ weekday: day + 1, hour, minute }),
  }));
  return scheduleVerifiedLocalNotifications(scheduled);
}

export async function scheduleMovementTestNotification(
  notification: MovementNotificationCopy,
  requestPermission = true,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const permission = await resolveLocalNotificationPermission(requestPermission);
  if (permission !== "granted") return false;
  await LocalNotifications.cancel({
    notifications: [{ id: MOVEMENT_TEST_NOTIFICATION_ID }],
  });
  return scheduleVerifiedLocalNotifications([{
    id: MOVEMENT_TEST_NOTIFICATION_ID,
    title: notification.title,
    body: notification.body,
    extra: { kind: MOVEMENT_TEST_KIND },
    schedule: reminderScheduleAt(new Date(Date.now() + MOVEMENT_TEST_DELAY_MS)),
  }]);
}

export async function scheduleMovementSnooze(
  notification: MovementNotificationCopy,
): Promise<Date> {
  const fireAt = new Date(Date.now() + 10 * 60 * 1000);
  if (!Capacitor.isNativePlatform()) return fireAt;
  const permission = await resolveLocalNotificationPermission(false);
  if (permission !== "granted") return fireAt;
  await LocalNotifications.cancel({
    notifications: [{ id: MOVEMENT_SNOOZE_NOTIFICATION_ID }],
  });
  await scheduleVerifiedLocalNotifications([{
    id: MOVEMENT_SNOOZE_NOTIFICATION_ID,
    title: notification.title,
    body: notification.body,
    extra: { kind: MOVEMENT_SNOOZE_KIND },
    schedule: reminderScheduleAt(fireAt),
  }]);
  return fireAt;
}
