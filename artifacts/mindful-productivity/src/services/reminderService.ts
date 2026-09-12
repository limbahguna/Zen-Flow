/**
 * ReminderService — abstraction layer for local reminders.
 *
 * Current implementation (WebReminderService):
 *   - Uses the browser Notifications API when available and permitted.
 *   - Falls back to an in-app banner (via a callback) when:
 *       • Notifications API not supported
 *       • Permission denied
 *       • App is the active tab (in-app banner is friendlier)
 *   - Provides in-app scheduler (setInterval) that fires when the app is open.
 *
 * ⚠️  Background limitation (documented, not hidden):
 *   A web app served from Replit (or any static host without a persistent server)
 *   cannot reliably deliver notifications when the browser tab is closed.
 *   True background reminders require either:
 *     a) Web Push (VAPID keys + push server — backend work needed), or
 *     b) Capacitor Local Notifications (for native iOS/Android builds).
 *   This interface is designed so that a CapacitorReminderService can be swapped
 *   in later without changing any UI component code.
 *
 * Interface contract:
 *   ReminderService.requestPermission()    → "granted" | "denied" | "unsupported"
 *   ReminderService.getPermissionStatus()  → "granted" | "denied" | "default" | "unsupported"
 *   ReminderService.showTestNotification() → Promise<void>
 *   ReminderService.scheduleReminder()     → starts in-app scheduler
 *   ReminderService.cancelReminder()       → stops in-app scheduler
 *   ReminderService.snoozeReminder()       → schedules one-off +10 min in-app
 */

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

// ── Utilities ─────────────────────────────────────────────────────────────────

function isNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && window.Notification != null;
}

function isInQuietHours(quietStart: string, quietEnd: string): boolean {
  const now = new Date();
  const hhmm = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const qs = hhmm(quietStart);
  const qe = hhmm(quietEnd);
  if (qs <= qe) return cur >= qs && cur < qe;
  // Wraps midnight
  return cur >= qs || cur < qe;
}

function isScheduledNow(config: ReminderConfig): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun…6=Sat
  if (!config.days.includes(dayOfWeek)) return false;
  const [h, m] = config.time.split(":").map(Number);
  return now.getHours() === h && now.getMinutes() === m;
}

// ── Web implementation ────────────────────────────────────────────────────────

class WebReminderService {
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;
  private snoozeTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastFiredMinute: string | null = null;
  private onBanner: InAppBannerCallback | null = null;

  /** Register the callback that shows an in-app banner. */
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
      // Prefer SW-backed notification when available
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
      // Fallback: in-app banner
      this.onBanner?.(notification);
    }
  }

  /**
   * Start the in-app scheduler.
   * Fires at most once per minute. Checks quiet hours and day/time match.
   */
  scheduleReminder(config: ReminderConfig, notification: ReminderNotification) {
    this.cancelReminder();
    this.schedulerInterval = setInterval(() => {
      if (!config.enabled) return;
      if (isInQuietHours(config.quietStart, config.quietEnd)) return;
      if (!isScheduledNow(config)) return;
      // Deduplicate: only fire once per HH:MM slot
      const key = `${new Date().getHours()}:${new Date().getMinutes()}`;
      if (this.lastFiredMinute === key) return;
      this.lastFiredMinute = key;
      this.showTestNotification(notification);
    }, 10_000); // poll every 10s (fires within 10s of scheduled time)
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

  /** Show a one-off reminder 10 minutes from now (in-app). */
  snoozeReminder(notification: ReminderNotification): Date {
    if (this.snoozeTimeout !== null) clearTimeout(this.snoozeTimeout);
    const fireAt = new Date(Date.now() + 10 * 60 * 1000);
    this.snoozeTimeout = setTimeout(() => {
      this.showTestNotification(notification);
      this.snoozeTimeout = null;
    }, 10 * 60 * 1000);
    return fireAt;
  }
}

export const reminderService = new WebReminderService();

// ── Movement reminder config helpers ─────────────────────────────────────────

const MOVEMENT_REMINDER_KEY = "mindful_movement_reminder";

export const DEFAULT_MOVEMENT_CONFIG: ReminderConfig = {
  enabled: false,
  time: "10:00",
  days: [1, 2, 3, 4, 5], // Mon–Fri
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

// ── Movement session completion helpers ───────────────────────────────────────

const MOVEMENT_COMPLETIONS_KEY = "mindful_movement_completions";

export function recordMovementCompletion(dateStr: string): boolean {
  try {
    const raw = localStorage.getItem(MOVEMENT_COMPLETIONS_KEY);
    const completions: string[] = raw ? JSON.parse(raw) : [];
    if (completions.includes(dateStr)) return false; // already recorded today
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
