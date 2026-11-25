import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { DailyRhythmConfig } from "./dailyRhythmNotifications";
import { reminderScheduleAt, resolveLocalNotificationPermission, scheduleVerifiedLocalNotifications } from "./localReminderNotifications";
import { isTimeInQuietHours } from "./movementNotifications";

export const STRESS_NUDGE_KIND = "stress_nudge";
/** Dedicated range. Daily Rhythm uses 43_000_000; movement uses 42_600_000+. */
export const STRESS_NUDGE_BASE_ID = 43_100_000;
const NUDGE_TIMES = ["17:00", "10:00"] as const;

export function stressNudgeFireAt(
  config: Pick<DailyRhythmConfig, "masterEnabled" | "quietStart" | "quietEnd">,
  threeDayElevated: boolean,
  now = new Date(),
): Date | null {
  if (!config.masterEnabled || !threeDayElevated) return null;
  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    for (const time of NUDGE_TIMES) {
      if (isTimeInQuietHours(time, config.quietStart, config.quietEnd)) continue;
      const [hour, minute] = time.split(":").map(Number);
      const at = new Date(now);
      at.setSeconds(0, 0);
      at.setDate(now.getDate() + dayOffset);
      at.setHours(hour ?? 17, minute ?? 0, 0, 0);
      if (at.getTime() > now.getTime()) return at;
    }
  }
  return null;
}

export async function syncStressNudge(options: {
  config: DailyRhythmConfig;
  threeDayElevated: boolean;
  title: string;
  body: string;
  now?: Date;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  await LocalNotifications.cancel({ notifications: [{ id: STRESS_NUDGE_BASE_ID }] });
  const at = stressNudgeFireAt(options.config, options.threeDayElevated, options.now);
  if (!at) return false;
  const permission = await resolveLocalNotificationPermission(false);
  if (permission !== "granted") return false;
  return scheduleVerifiedLocalNotifications([
    {
      id: STRESS_NUDGE_BASE_ID,
      title: options.title,
      body: options.body,
      extra: { kind: STRESS_NUDGE_KIND, path: "/progress" },
      schedule: reminderScheduleAt(at),
    },
  ]);
}
