import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Intention } from "./intentions";
import {
  reminderScheduleAt,
  reminderScheduleOn,
  resolveLocalNotificationPermission,
  scheduleVerifiedLocalNotifications,
} from "./localReminderNotifications";
import { isMovementNotificationExtra } from "./movementNotifications";

const MAX_NOTIFICATION_SLOTS = 7;
export const INTENTION_DEEP_LINK = "/practice?tab=intentions";

export function intentionPathFromNotificationExtra(extra: unknown): string | null {
  if (!extra || typeof extra !== "object") return null;
  const path = (extra as { path?: unknown }).path;
  return typeof path === "string" &&
    path.startsWith(`${INTENTION_DEEP_LINK}&intention=`)
    ? path
    : null;
}

export function isIntentionNotificationExtra(extra: unknown): boolean {
  if (!extra || typeof extra !== "object") return false;
  return typeof (extra as { intentionId?: unknown }).intentionId === "string" ||
    intentionPathFromNotificationExtra(extra) !== null;
}

export function intentionNotificationBaseId(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (Math.abs(hash) % 300_000_000) * 10 + 1;
}

export async function cancelIntentionReminder(id: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const base = intentionNotificationBaseId(id);
  await LocalNotifications.cancel({
    notifications: Array.from({ length: MAX_NOTIFICATION_SLOTS }, (_, index) => ({
      id: base + index,
    })),
  });
}

export async function clearDeviceIntentionNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const pending = await LocalNotifications.getPending();
  const intentionPending = pending.notifications.filter((item) =>
    isIntentionNotificationExtra(item.extra) && !isMovementNotificationExtra(item.extra),
  );
  if (intentionPending.length > 0) {
    await LocalNotifications.cancel({
      notifications: intentionPending.map(({ id }) => ({ id })),
    });
  }
}

function timeParts(value: string | null) {
  const [hour = "9", minute = "0"] = (value ?? "09:00").split(":");
  return { hour: Number(hour), minute: Number(minute) };
}

function nextOccurrence(hour: number, minute: number): Date {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return date;
}

export async function scheduleIntentionReminder(
  intention: Intention,
  requestPermission = true,
): Promise<boolean> {
  await cancelIntentionReminder(intention.id);
  if (
    !Capacitor.isNativePlatform() ||
    intention.status !== "active" ||
    intention.reminder_choice === "off" ||
    !intention.reminder_time
  ) return false;

  const permission = await resolveLocalNotificationPermission(requestPermission);
  if (permission !== "granted") return false;

  const { hour, minute } = timeParts(intention.reminder_time);
  const base = intentionNotificationBaseId(intention.id);
  const extra = {
    intentionId: intention.id,
    path: `${INTENTION_DEEP_LINK}&intention=${encodeURIComponent(intention.id)}`,
  };
  const common = {
    title: "Today's intention",
    body: intention.small_action,
    extra,
  };

  if (intention.frequency === "selected_days") {
    return scheduleVerifiedLocalNotifications(
      intention.selected_days.map((day, index) => ({
        ...common,
        id: base + index,
        schedule: reminderScheduleOn({ weekday: day + 1, hour, minute }),
      })),
    );
  }
  if (intention.frequency === "daily") {
    return scheduleVerifiedLocalNotifications([{
      ...common,
      id: base,
      schedule: reminderScheduleOn({ hour, minute }),
    }]);
  }
  return scheduleVerifiedLocalNotifications([{
    ...common,
    id: base,
    schedule: reminderScheduleAt(nextOccurrence(hour, minute)),
  }]);
}
