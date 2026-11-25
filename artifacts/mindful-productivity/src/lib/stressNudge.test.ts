import { describe, expect, it } from "vitest";
import { defaultDailyRhythmConfig } from "./dailyRhythmNotifications";
import { STRESS_NUDGE_BASE_ID, stressNudgeFireAt } from "./stressNudge";

describe("stress nudge", () => {
  const config = {
    ...defaultDailyRhythmConfig(),
    masterEnabled: true,
    quietStart: "22:30",
    quietEnd: "07:00",
  };

  it("uses a dedicated id range that does not collide with Daily Rhythm", () => {
    expect(STRESS_NUDGE_BASE_ID).toBe(43_100_000);
    expect(STRESS_NUDGE_BASE_ID).toBeGreaterThan(43_000_000 + 200);
  });

  it("schedules one future time outside quiet hours only when the 3-day estimate is elevated", () => {
    const now = new Date(2026, 2, 3, 9, 0, 0);
    const at = stressNudgeFireAt(config, true, now);
    expect(at).not.toBeNull();
    expect(at!.getHours()).toBe(17);
    expect(stressNudgeFireAt(config, false, now)).toBeNull();
    expect(stressNudgeFireAt({ ...config, masterEnabled: false }, true, now)).toBeNull();
  });

  it("skips a candidate that falls inside quiet hours", () => {
    const quiet = { ...config, quietStart: "16:00", quietEnd: "18:00" };
    const now = new Date(2026, 2, 3, 11, 0, 0);
    const at = stressNudgeFireAt(quiet, true, now);
    expect(at?.getHours()).toBe(10);
    expect(at?.getDate()).toBe(4);
  });
});
