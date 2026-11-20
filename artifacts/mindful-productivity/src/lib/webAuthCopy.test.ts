import { describe, expect, it } from "vitest";
import { LANGUAGE_OPTIONS, t, type LanguageCode } from "./translations";
import {
  WEB_AUTH_ARABIC,
  isWebAuthLanguage,
  webAuthLanguageOptions,
  webAuthText,
  type WebAuthLanguage,
} from "./webAuthCopy";

describe("web auth language options", () => {
  it("offers English, Indonesian, Japanese, and Arabic on native", () => {
    expect(webAuthLanguageOptions(true).map((option) => option.code)).toEqual([
      "en",
      "id",
      "ja",
      "ar",
    ]);
  });

  it("offers the same options on web as on native", () => {
    expect(webAuthLanguageOptions(false)).toEqual(webAuthLanguageOptions(true));
    expect(webAuthLanguageOptions(false)).toBe(LANGUAGE_OPTIONS);
  });

  it("includes ar in LANGUAGE_OPTIONS", () => {
    expect(LANGUAGE_OPTIONS.map((option) => option.code)).toContain("ar");
  });

  it("folds the legacy WEB_AUTH_ARABIC constant into LanguageCode", () => {
    const code: LanguageCode = WEB_AUTH_ARABIC;
    const webLang: WebAuthLanguage = code;
    expect(webLang).toBe("ar");
    expect(isWebAuthLanguage("ar")).toBe(true);
    expect(isWebAuthLanguage("zh")).toBe(false);
  });

  it("returns Arabic login copy without falling back to English keys", () => {
    const arabic = webAuthText("ar", "auth.signin.submit", () => "Sign In");
    expect(arabic).toBe(t("ar", "auth.signin.submit"));
    expect(arabic).not.toBe("Sign In");
    expect(webAuthText("en", "auth.signin.submit", () => "Sign In")).toBe(
      t("en", "auth.signin.submit"),
    );
  });

  it("uses the fallback when the key is unknown", () => {
    expect(webAuthText("ar", "auth.unknown.key", () => "fallback")).toBe("fallback");
  });
});
