import { describe, expect, it } from "vitest";
import {
  AUTH_ARABIC_COPY,
  webAuthLanguageOptions,
  webAuthText,
} from "./webAuthCopy";

describe("web auth language options", () => {
  it("keeps native selectors to English, Indonesian, and Japanese", () => {
    expect(webAuthLanguageOptions(true).map((option) => option.code)).toEqual([
      "en",
      "id",
      "ja",
    ]);
  });

  it("adds Arabic for the public web login only", () => {
    expect(webAuthLanguageOptions(false).map((option) => option.code)).toEqual([
      "en",
      "id",
      "ja",
      "ar",
    ]);
  });

  it("returns Arabic login copy without falling back to English keys", () => {
    expect(webAuthText("ar", "auth.signin.submit", () => "Sign In")).toBe(
      AUTH_ARABIC_COPY["auth.signin.submit"],
    );
    expect(webAuthText("en", "auth.signin.submit", () => "Sign In")).toBe("Sign In");
  });
});
