import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { t, type LanguageCode } from "./translations";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

const USER_FACING_BANNED = [
  "Micro Lessons",
  "Micro Lesson",
  "Micro Pelajaran",
  "マイクロレッスン",
];

describe("Daily Insight user-facing terminology", () => {
  it("localizes the dashboard lesson label in EN / ID / JA", () => {
    expect(t("en", "dashboard.quickActions.lessons")).toBe("Daily Insight");
    expect(t("id", "dashboard.quickActions.lessons")).toBe("Wawasan Harian");
    expect(t("ja", "dashboard.quickActions.lessons")).toBe("デイリーインサイト");
  });

  it("renders the dashboard eyebrow and quick-action from the translation key", () => {
    const dashboard = readSrc("pages/dashboard.tsx");
    expect(dashboard).toContain('t("dashboard.quickActions.lessons")');
    expect(dashboard).not.toMatch(/Micro Lessons|MICRO LESSONS|Micro Lesson/);
  });

  it("does not keep Micro Lesson copy in EN / ID / JA UI dictionaries", () => {
    const languages: LanguageCode[] = ["en", "id", "ja"];
    const keys = [
      "dashboard.quickActions.lessons",
      "dashboard.quickActions.lessonsSub",
      "practice.tab.lessons",
      "learn.empty.title",
      "learn.error.title",
      "lesson.feedback.question",
      "lesson.toast.error.title",
    ];
    for (const language of languages) {
      for (const key of keys) {
        const value = t(language, key);
        for (const banned of USER_FACING_BANNED) {
          expect(value).not.toContain(banned);
        }
      }
    }
  });
});
