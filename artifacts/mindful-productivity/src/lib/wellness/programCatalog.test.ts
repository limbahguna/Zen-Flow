import { describe, expect, it } from "vitest";
import { getTranslationKeys, t, type LanguageCode } from "../translations";
import {
  PROGRAM_CATALOG,
  PROGRAM_LIST,
  getProgram,
  getProgramDay,
  programBenefitKeys,
  programDailyMinutes,
  programTitleKeys,
} from "./programCatalog";

describe("program catalog", () => {
  it("defines 7, 14, and 21 typed days", () => {
    expect(getProgram("calm-reset").durationDays).toBe(7);
    expect(getProgram("calm-reset").days).toHaveLength(7);
    expect(getProgram("better-sleep").durationDays).toBe(14);
    expect(getProgram("better-sleep").days).toHaveLength(14);
    expect(getProgram("focus-habit").durationDays).toBe(21);
    expect(getProgram("focus-habit").days).toHaveLength(21);
  });

  it("uses translation keys instead of English display text on days", () => {
    for (const program of PROGRAM_LIST) {
      expect(program.titleKey.startsWith("programs.")).toBe(true);
      expect(program.benefitKey.startsWith("programs.")).toBe(true);
      for (const day of program.days) {
        expect(day.practiceContentKey.startsWith("programs.")).toBe(true);
        expect(day.reflectionContentKey.startsWith("programs.")).toBe(true);
        expect(day.plannedMinutes).toBeGreaterThan(0);
        expect(day.practiceKind).toBeTruthy();
      }
    }
  });

  it("contains no diagnosis, treatment, cure, or medical claims", () => {
    const blob = JSON.stringify(PROGRAM_CATALOG).toLowerCase();
    for (const banned of ["diagnos", "treatment", "cure", "medical", "prescription", "therapist"]) {
      expect(blob).not.toContain(banned);
    }
  });

  it("returns null for an out-of-range program day", () => {
    expect(getProgramDay("calm-reset", 0)).toBeNull();
    expect(getProgramDay("calm-reset", 8)).toBeNull();
  });

  it("exposes daily minutes from the catalog days, not a UI constant", () => {
    expect(programDailyMinutes(getProgram("calm-reset"))).toBe(
      getProgram("calm-reset").days[0]?.plannedMinutes,
    );
  });
});

describe("minimal program translation keys", () => {
  const keys = [
    ...programTitleKeys(),
    ...programBenefitKeys(),
    "programs.practice.breathing",
    "programs.practice.relaxation",
    "programs.practice.focusTimer",
    "programs.practice.sleepRoutine",
    "programs.practice.movement",
    "programs.reflection.prompt",
  ];
  const languages: LanguageCode[] = ["en", "id", "ja"];

  it("exists in en, id, and ja and is not the raw key", () => {
    for (const language of languages) {
      const present = new Set(getTranslationKeys(language));
      for (const key of keys) {
        expect(present.has(key)).toBe(true);
        expect(t(language, key)).not.toBe(key);
        expect(t(language, key).length).toBeGreaterThan(0);
      }
    }
  });
});
