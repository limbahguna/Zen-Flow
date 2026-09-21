import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export const MINDFUL_REMINDER_CHANNEL_ID = "mindful_space_reminders";

export type LocalPermissionStatus = "granted" | "denied" | "default";

export interface SchedulableLocalNotification {
  id: number;
  title: string;
  body: string;
  extra?: Record<string, unknown>;
  schedule?: {
    at?: Date;
    on?: { weekday?: number; hour: number; minute: number };
    allowWhileIdle?: boolean;
  };
  channelId?: string;
}

function displayToStatus(display: string | undefined): LocalPermissionStatus {
  if (display === "granted") return "granted";
  if (display === "denied") return "denied";
  return "default";
}

export async function ensureMindfulReminderChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await LocalNotifications.createChannel({
    id: MINDFUL_REMINDER_CHANNEL_ID,
    name: "Mindful Space reminders",
    description: "Intention and movement reminders",
    importance: 4,
    visibility: 1,
    sound: "default",
    vibration: true,
    lights: true,
  });
}

export async function resolveLocalNotificationPermission(
  request: boolean,
): Promise<LocalPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return "denied";
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return "granted";
  if (!request) return displayToStatus(current.display);
  const next = await LocalNotifications.requestPermissions();
  return displayToStatus(next.display);
}

export async function scheduleVerifiedLocalNotifications(
  notifications: SchedulableLocalNotification[],
): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || notifications.length === 0) return false;
  await ensureMindfulReminderChannel();
  const withChannel = notifications.map((notification) => ({
    ...notification,
    channelId: MINDFUL_REMINDER_CHANNEL_ID,
  }));
  await LocalNotifications.schedule({ notifications: withChannel });
  const pending = await LocalNotifications.getPending();
  const pendingIds = new Set(pending.notifications.map((item) => item.id));
  return withChannel.every((notification) => pendingIds.has(notification.id));
}

export function reminderScheduleOn(parts: {
  weekday?: number;
  hour: number;
  minute: number;
}) {
  return {
    on: parts,
    allowWhileIdle: true,
  };
}

export function reminderScheduleAt(at: Date) {
  return {
    at,
    allowWhileIdle: true,
  };
}
