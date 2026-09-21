import type { PracticeKind, PrimaryGoal, ProgramSlug } from "./types";

export interface ProgramDayDefinition {
  day: number;
  practiceKind: PracticeKind;
  plannedMinutes: number;
  practiceContentKey: string;
  reflectionContentKey: string;
}

export interface ProgramDefinition {
  slug: ProgramSlug;
  titleKey: string;
  benefitKey: string;
  goal: PrimaryGoal;
  durationDays: number;
  days: ProgramDayDefinition[];
}

const REFLECTION_KEY = "programs.reflection.prompt";

export const PRACTICE_CONTENT_KEYS: Record<PracticeKind, string> = {
  breathing: "programs.practice.breathing",
  relaxation: "programs.practice.relaxation",
  focus_timer: "programs.practice.focusTimer",
  sleep_routine: "programs.practice.sleepRoutine",
  movement: "programs.practice.movement",
};

const FALLBACK_PRACTICE: Record<PrimaryGoal, PracticeKind> = {
  stress: "breathing",
  sleep: "sleep_routine",
  focus: "focus_timer",
  motivation: "movement",
  self_compassion: "relaxation",
  habit: "movement",
};

function buildDays(
  duration: number,
  pattern: PracticeKind[],
): ProgramDayDefinition[] {
  return Array.from({ length: duration }, (_, index) => {
    const practiceKind = pattern[index % pattern.length]!;
    return {
      day: index + 1,
      practiceKind,
      plannedMinutes: 5,
      practiceContentKey: PRACTICE_CONTENT_KEYS[practiceKind],
      reflectionContentKey: REFLECTION_KEY,
    };
  });
}

export const PROGRAM_CATALOG: Record<ProgramSlug, ProgramDefinition> = {
  "calm-reset": {
    slug: "calm-reset",
    titleKey: "programs.calmReset.title",
    benefitKey: "programs.calmReset.benefit",
    goal: "stress",
    durationDays: 7,
    days: buildDays(7, ["breathing", "relaxation", "movement"]),
  },
  "better-sleep": {
    slug: "better-sleep",
    titleKey: "programs.betterSleep.title",
    benefitKey: "programs.betterSleep.benefit",
    goal: "sleep",
    durationDays: 14,
    days: buildDays(14, ["sleep_routine", "breathing", "relaxation"]),
  },
  "focus-habit": {
    slug: "focus-habit",
    titleKey: "programs.focusHabit.title",
    benefitKey: "programs.focusHabit.benefit",
    goal: "focus",
    durationDays: 21,
    days: buildDays(21, ["focus_timer", "movement", "breathing"]),
  },
};

export const PROGRAM_LIST: ProgramDefinition[] = [
  PROGRAM_CATALOG["calm-reset"],
  PROGRAM_CATALOG["better-sleep"],
  PROGRAM_CATALOG["focus-habit"],
];

export function getProgram(slug: ProgramSlug): ProgramDefinition {
  return PROGRAM_CATALOG[slug];
}

export function getProgramDay(
  slug: ProgramSlug,
  day: number,
): ProgramDayDefinition | null {
  const program = PROGRAM_CATALOG[slug];
  if (day < 1 || day > program.durationDays) return null;
  return program.days[day - 1] ?? null;
}

export function fallbackPracticeKind(goal: PrimaryGoal): PracticeKind {
  return FALLBACK_PRACTICE[goal];
}

export function programTitleKeys(): string[] {
  return PROGRAM_LIST.map((program) => program.titleKey);
}

export function programBenefitKeys(): string[] {
  return PROGRAM_LIST.map((program) => program.benefitKey);
}

export function programDailyMinutes(program: ProgramDefinition): number {
  return program.days[0]?.plannedMinutes ?? 0;
}

export function programPracticeKinds(program: ProgramDefinition): PracticeKind[] {
  const seen = new Set<PracticeKind>();
  const kinds: PracticeKind[] = [];
  for (const day of program.days) {
    if (seen.has(day.practiceKind)) continue;
    seen.add(day.practiceKind);
    kinds.push(day.practiceKind);
  }
  return kinds;
}
