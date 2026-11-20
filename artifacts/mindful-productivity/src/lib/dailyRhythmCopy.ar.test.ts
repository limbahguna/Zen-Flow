import { describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {},
}));

import { dailyRhythmCopyFromTranslations } from "./dailyRhythmCopy";
import { DAILY_RHYTHM_KEYS, pathFromNotificationExtra } from "./dailyRhythmNotifications";
import { t as translate } from "./translations";

const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

describe("daily rhythm notification copy — Arabic", () => {
  it("t('ar', 'rhythm.notification.title') resolves to the brand title, not the raw key", () => {
    // The notification title is the brand name ("KindEase") in every language.
    const title = translate("ar", "rhythm.notification.title");
    expect(title).not.toBe("rhythm.notification.title");
    expect(title.length).toBeGreaterThan(0);
  });

  it("t('ar', rhythm body keys) are Arabic, not English or the raw key", () => {
    const body = translate("ar", "rhythm.body.morningBoost.0");
    expect(body).not.toBe("rhythm.body.morningBoost.0");
    expect(body).not.toBe(translate("en", "rhythm.body.morningBoost.0"));
    expect(body).toMatch(ARABIC_SCRIPT);
  });

  it("dailyRhythmCopyFromTranslations with an ar-bound t produces the title and Arabic bodies", () => {
    const stubT = vi.fn((key: string, values?: Record<string, string | number>) =>
      translate("ar", key, values),
    );
    const copy = dailyRhythmCopyFromTranslations(stubT);

    expect(copy.title).toBe(translate("ar", "rhythm.notification.title"));
    expect(stubT).toHaveBeenCalledWith("rhythm.notification.title");
    for (const key of DAILY_RHYTHM_KEYS) {
      expect(copy.bodies[key].length).toBeGreaterThan(0);
      for (const body of copy.bodies[key]) {
        expect(body).toMatch(ARABIC_SCRIPT);
      }
    }
  });

  it("a different language's t yields different copy (reschedule on language change)", () => {
    const en = dailyRhythmCopyFromTranslations((key, values) => translate("en", key, values));
    const ar = dailyRhythmCopyFromTranslations((key, values) => translate("ar", key, values));
    expect(ar.bodies.morningBoost[0]).not.toBe(en.bodies.morningBoost[0]);
  });
});

describe("pathFromNotificationExtra — unaffected by Arabic locale", () => {
  it("still returns safe in-app paths and rejects unsafe ones", () => {
    expect(pathFromNotificationExtra({ path: "/daily-plan" })).toBe("/daily-plan");
    expect(pathFromNotificationExtra({ path: "/practice?tab=journal" })).toBe(
      "/practice?tab=journal",
    );
    expect(pathFromNotificationExtra({ path: "//evil.test" })).toBeNull();
    expect(pathFromNotificationExtra({ path: "/auth?code=x" })).toBeNull();
    expect(pathFromNotificationExtra(undefined)).toBeNull();
  });
});
