import type { DailyRhythmCopy, DailyRhythmKey } from "./dailyRhythmNotifications";
import { DAILY_RHYTHM_KEYS } from "./dailyRhythmNotifications";

type Translate = (key: string, values?: Record<string, string | number>) => string;

const BODY_COUNTS: Record<DailyRhythmKey, number> = {
  morningBoost: 3,
  intentionNudge: 1,
  movementBreak: 2,
  breathingReset: 1,
  eveningJournal: 1,
  sleepWindDown: 2,
};

export function dailyRhythmCopyFromTranslations(t: Translate): DailyRhythmCopy {
  const bodies = {} as Record<DailyRhythmKey, string[]>;
  for (const key of DAILY_RHYTHM_KEYS) {
    const count = BODY_COUNTS[key];
    bodies[key] = Array.from({ length: count }, (_, index) =>
      t(`rhythm.body.${key}.${index}`),
    );
  }
  return {
    title: t("rhythm.notification.title"),
    bodies,
  };
}
