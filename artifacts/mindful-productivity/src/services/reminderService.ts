/**
 * ReminderService — abstraction layer for local reminders.
 *
 * Web fallback (WebReminderService):
 *   - Browser Notifications API when available and permitted.
 *   - In-app banner when unsupported, denied, or as a friendlier foreground UX.
 *   - setInterval scheduler that only fires while the tab is open.
 *
 * Capacitor Android:
 *   - @capacitor/local-notifications, including background/closed-app delivery.
 *   - Browser Notification/setInterval is not used on native.
 */

import { Capacitor } from "@capacitor/core";
import { resolveLocalNotificationPermission } from "@/lib/localReminderNotifications";
import {
  cancelMovementReminders,
  isTimeInQuietHours,
  scheduleMovementReminder,
  scheduleMovementSnooze,
  scheduleMovementTestNotification,
} from "@/lib/movementNotifications";

export type PermissionStatus = "granted" | "denied" | "default" | "unsupported";

export interface ReminderConfig {
  /** HH:MM string in 24h format, e.g. "09:00" */
  time: string;
  /** 0=Sun 1=Mon … 6=Sat */
  days: number[];
  /** minutes */
  duration: 5 | 10 | 15;
  type: "stretch" | "walk" | "desk" | "free";
  /** Quiet hours range — no reminders sent during this window */
  quietStart: string; // HH:MM
  quietEnd: string;   // HH:MM
  enabled: boolean;
}

export interface ReminderNotification {
  title: string;
  body: string;
}

/** Callback invoked when an in-app banner should be shown. */
export type InAppBannerCallback = (notification: ReminderNotification) => void;

function isNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && window.Notification != null;
}

function isInQuietHours(quietStart: string, quietEnd: string): boolean {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return isTimeInQuietHours(hhmm, quietStart, quietEnd);
}

function isScheduledNow(config: ReminderConfig): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun…6=Sat
  if (!config.days.includes(dayOfWeek)) return false;
  const [h, m] = config.time.split(":").map(Number);
  return now.getHours() === h && now.getMinutes() === m;
}

class WebReminderService {
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;
  private snoozeTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastFiredMinute: string | null = null;
  private onBanner: InAppBannerCallback | null = null;

  setBannerCallback(cb: InAppBannerCallback) {
    this.onBanner = cb;
  }

  async requestPermission(): Promise<PermissionStatus> {
    if (!isNotificationsSupported()) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    try {
      const result = await Notification.requestPermission();
      return result as PermissionStatus;
    } catch {
      return "unsupported";
    }
  }

  getPermissionStatus(): PermissionStatus {
    if (!isNotificationsSupported()) return "unsupported";
    return Notification.permission as PermissionStatus;
  }

  async showTestNotification(notification: ReminderNotification): Promise<void> {
    const status = await this.requestPermission();
    if (status === "granted" && isNotificationsSupported()) {
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(notification.title, {
            body: notification.body,
            icon: "/icons/icon-192.png",
          });
          return;
        } catch {
          // fall through to plain Notification
        }
      }
      new Notification(notification.title, {
        body: notification.body,
        icon: "/icons/icon-192.png",
      });
    } else {
      this.onBanner?.(notification);
    }
  }

  scheduleReminder(config: ReminderConfig, notification: ReminderNotification) {
    this.cancelReminder();
    this.schedulerInterval = setInterval(() => {
      if (!config.enabled) return;
      if (isInQuietHours(config.quietStart, config.quietEnd)) return;
      if (!isScheduledNow(config)) return;
      const key = `${new Date().getHours()}:${new Date().getMinutes()}`;
      if (this.lastFiredMinute === key) return;
      this.lastFiredMinute = key;
      void this.showTestNotification(notification);
    }, 10_000);
  }

  cancelReminder() {
    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    if (this.snoozeTimeout !== null) {
      clearTimeout(this.snoozeTimeout);
      this.snoozeTimeout = null;
    }
    this.lastFiredMinute = null;
  }

  snoozeReminder(notification: ReminderNotification): Date {
    if (this.snoozeTimeout !== null) clearTimeout(this.snoozeTimeout);
    const fireAt = new Date(Date.now() + 10 * 60 * 1000);
    this.snoozeTimeout = setTimeout(() => {
      void this.showTestNotification(notification);
      this.snoozeTimeout = null;
    }, 10 * 60 * 1000);
    return fireAt;
  }
}

const webReminderService = new WebReminderService();
let nativePermissionStatus: PermissionStatus = "default";

function isNativeReminders(): boolean {
  return Capacitor.isNativePlatform();
}

export function movementReminderCopy(
  config: ReminderConfig,
  translate: (key: string) => string,
): ReminderNotification {
  return {
    title: translate("reminder.banner.title"),
    body: translate("reminder.banner.body")
      .replace("{duration}", String(config.duration))
      .replace("{type}", translate(`profile.movement.type.${config.type}`)),
  };
}

export const reminderService = {
  setBannerCallback(cb: InAppBannerCallback) {
    webReminderService.setBannerCallback(cb);
  },

  getPermissionStatus(): PermissionStatus {
    if (isNativeReminders()) return nativePermissionStatus;
    return webReminderService.getPermissionStatus();
  },

  async refreshPermission(): Promise<PermissionStatus> {
    if (isNativeReminders()) {
      nativePermissionStatus = await resolveLocalNotificationPermission(false);
      return nativePermissionStatus;
    }
    return webReminderService.getPermissionStatus();
  },

  async requestPermission(): Promise<PermissionStatus> {
    if (isNativeReminders()) {
      nativePermissionStatus = await resolveLocalNotificationPermission(true);
      return nativePermissionStatus;
    }
    return webReminderService.requestPermission();
  },

  async showTestNotification(notification: ReminderNotification): Promise<void> {
    if (isNativeReminders()) {
      const scheduled = await scheduleMovementTestNotification(notification, true);
      nativePermissionStatus = await resolveLocalNotificationPermission(false);
      if (!scheduled) throw new Error("Test notification was not pending after scheduling");
      return;
    }
    await webReminderService.showTestNotification(notification);
  },

  async scheduleReminder(
    config: ReminderConfig,
    notification: ReminderNotification,
  ): Promise<boolean> {
    if (isNativeReminders()) {
      if (!config.enabled) {
        await cancelMovementReminders();
        return true;
      }
      const scheduled = await scheduleMovementReminder(config, notification, false);
      nativePermissionStatus = await resolveLocalNotificationPermission(false);
      return scheduled;
    }
    if (!config.enabled) {
      webReminderService.cancelReminder();
      return true;
    }
    webReminderService.scheduleReminder(config, notification);
    return true;
  },

  async cancelReminder(): Promise<void> {
    if (isNativeReminders()) {
      await cancelMovementReminders();
      return;
    }
    webReminderService.cancelReminder();
  },

  snoozeReminder(notification: ReminderNotification): Date {
    if (isNativeReminders()) {
      void scheduleMovementSnooze(notification);
      return new Date(Date.now() + 10 * 60 * 1000);
    }
    return webReminderService.snoozeReminder(notification);
  },
};

const MOVEMENT_REMINDER_KEY = "mindful_movement_reminder";

export const DEFAULT_MOVEMENT_CONFIG: ReminderConfig = {
  enabled: false,
  time: "10:00",
  days: [1, 2, 3, 4, 5],
  duration: 5,
  type: "stretch",
  quietStart: "22:00",
  quietEnd: "08:00",
};

export function loadMovementConfig(): ReminderConfig {
  try {
    const raw = localStorage.getItem(MOVEMENT_REMINDER_KEY);
    if (!raw) return { ...DEFAULT_MOVEMENT_CONFIG };
    return { ...DEFAULT_MOVEMENT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_MOVEMENT_CONFIG };
  }
}

export function saveMovementConfig(config: ReminderConfig): void {
  try {
    localStorage.setItem(MOVEMENT_REMINDER_KEY, JSON.stringify(config));
  } catch {}
}

const MOVEMENT_COMPLETIONS_KEY = "mindful_movement_completions";

export function recordMovementCompletion(dateStr: string): boolean {
  try {
    const raw = localStorage.getItem(MOVEMENT_COMPLETIONS_KEY);
    const completions: string[] = raw ? JSON.parse(raw) : [];
    if (completions.includes(dateStr)) return false;
    completions.push(dateStr);
    localStorage.setItem(MOVEMENT_COMPLETIONS_KEY, JSON.stringify(completions));
    return true;
  } catch {
    return false;
  }
}

export function hasCompletedMovementToday(dateStr: string): boolean {
  try {
    const raw = localStorage.getItem(MOVEMENT_COMPLETIONS_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(dateStr);
  } catch {
    return false;
  }
}

export function getMovementCompletions(): string[] {
  try {
    const raw = localStorage.getItem(MOVEMENT_COMPLETIONS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
