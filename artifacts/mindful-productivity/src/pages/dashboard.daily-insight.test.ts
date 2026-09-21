import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relative: string): string {
  return readFileSync(resolve(ROOT, relative), "utf8");
}

describe("dashboard Daily Insight coherence", () => {
  it("uses the shared adaptive selector and does not create or complete a Daily Plan", () => {
    const dashboard = readSrc("pages/dashboard.tsx");
    const hook = readSrc("hooks/useAdaptiveDailyInsight.ts");
    const reader = readSrc("components/LessonReader.tsx");
    expect(dashboard).toContain("useAdaptiveDailyInsight");
    expect(dashboard).toContain("todays-lesson-reason");
    expect(dashboard).not.toContain("loadOrCreateDailyPlan");
    expect(dashboard).not.toContain("completeDailyPlanItem");
    expect(hook).toContain("getDailyPlanForDate");
    expect(hook).not.toContain("loadOrCreateDailyPlan");
    expect(hook).not.toContain("completeDailyPlanItem");
    expect(reader).toContain("saveLessonProgress");
    expect(reader).not.toContain("completeDailyPlanItem");
  });
});
