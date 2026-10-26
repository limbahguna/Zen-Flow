import { describe, expect, it } from "vitest";
import {
  LANDING_LANGUAGES,
  LANDING_LANGUAGE_OPTIONS,
  isLandingLanguage,
  isLandingRtl,
  landingKeys,
  landingText,
  type LandingLanguage,
} from "./landingCopy";

const langs = Object.keys(LANDING_LANGUAGES) as LandingLanguage[];

describe("landing copy completeness", () => {
  it("includes English, Indonesian, Arabic, and Japanese", () => {
    expect(langs.sort()).toEqual(["ar", "en", "id", "ja"]);
    expect(LANDING_LANGUAGE_OPTIONS.map((option) => option.code)).toEqual([
      "en",
      "id",
      "ar",
      "ja",
    ]);
  });

  it("keeps the same keys in every language with non-empty text", () => {
    const keys = landingKeys();
    expect(keys.length).toBeGreaterThan(20);
    for (const lang of langs) {
      for (const key of keys) {
        const value = landingText(lang, key);
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toBe(key);
      }
    }
  });

  it("marks only Arabic as RTL", () => {
    expect(isLandingRtl("ar")).toBe(true);
    expect(isLandingRtl("en")).toBe(false);
    expect(isLandingRtl("id")).toBe(false);
    expect(isLandingRtl("ja")).toBe(false);
  });

  it("rejects unsupported language codes", () => {
    expect(isLandingLanguage("en")).toBe(true);
    expect(isLandingLanguage("zh")).toBe(false);
  });
});
