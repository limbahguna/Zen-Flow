/**
 * Local practice-focus preferences.
 * Stored on-device only — never sent to APIs, Auth metadata, or analytics.
 */

export const FOCUS_GOAL_IDS = [
  "mood",
  "calm",
  "focus",
  "sleep",
  "journal",
] as const;

export type FocusGoalId = (typeof FOCUS_GOAL_IDS)[number];

export const FOCUS_GOAL_COPY: Record<
  FocusGoalId,
  { titleKey: string; descKey: string; artLabelKey: string }
> = {
  mood: {
    titleKey: "onboarding.goals.mood.title",
    descKey: "onboarding.goals.mood.desc",
    artLabelKey: "onboarding.goals.mood.art",
  },
  calm: {
    titleKey: "onboarding.goals.calm.title",
    descKey: "onboarding.goals.calm.desc",
    artLabelKey: "onboarding.goals.calm.art",
  },
  focus: {
    titleKey: "onboarding.goals.focus.title",
    descKey: "onboarding.goals.focus.desc",
    artLabelKey: "onboarding.goals.focus.art",
  },
  sleep: {
    titleKey: "onboarding.goals.sleep.title",
    descKey: "onboarding.goals.sleep.desc",
    artLabelKey: "onboarding.goals.sleep.art",
  },
  journal: {
    titleKey: "onboarding.goals.journal.title",
    descKey: "onboarding.goals.journal.desc",
    artLabelKey: "onboarding.goals.journal.art",
  },
};

export interface FocusGoalsRecord {
  version: 1;
  goals: FocusGoalId[];
  skipped: boolean;
}

const STORAGE_PREFIX = "mindful_focus_goals_";
const ONBOARDING_PREFIX = "onboarding_completed_";

export function focusGoalsStorageKey(userId: string): string {
  return STORAGE_PREFIX + userId;
}

export function onboardingCompletedKey(userId: string): string {
  return ONBOARDING_PREFIX + userId;
}

export function isFocusGoalId(value: unknown): value is FocusGoalId {
  return typeof value === "string" && (FOCUS_GOAL_IDS as readonly string[]).includes(value);
}

export function sanitizeFocusGoals(values: unknown): FocusGoalId[] {
  if (!Array.isArray(values)) return [];
  const unique: FocusGoalId[] = [];
  for (const value of values) {
    if (isFocusGoalId(value) && !unique.includes(value)) unique.push(value);
  }
  return unique;
}

export function parseFocusGoalsRecord(raw: string | null): FocusGoalsRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<FocusGoalsRecord>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      version: 1,
      goals: sanitizeFocusGoals(parsed.goals),
      skipped: parsed.skipped === true,
    };
  } catch {
    return null;
  }
}

export function loadFocusGoalsRecord(userId: string): FocusGoalsRecord | null {
  if (!userId) return null;
  try {
    return parseFocusGoalsRecord(localStorage.getItem(focusGoalsStorageKey(userId)));
  } catch {
    return null;
  }
}

export function loadFocusGoals(userId: string): FocusGoalId[] {
  return loadFocusGoalsRecord(userId)?.goals ?? [];
}

export function saveFocusGoalsRecord(userId: string, record: FocusGoalsRecord): void {
  if (!userId) return;
  try {
    localStorage.setItem(
      focusGoalsStorageKey(userId),
      JSON.stringify({
        version: 1,
        goals: sanitizeFocusGoals(record.goals),
        skipped: record.skipped,
      } satisfies FocusGoalsRecord),
    );
  } catch {
    // Storage denied — do not block the app.
  }
}

export function saveFocusGoals(userId: string, goals: FocusGoalId[]): void {
  saveFocusGoalsRecord(userId, { version: 1, goals: sanitizeFocusGoals(goals), skipped: false });
}

export function markOnboardingDone(userId: string): void {
  if (!userId) return;
  try {
    localStorage.setItem(onboardingCompletedKey(userId), "1");
  } catch {
    // ignore
  }
}

export function onboardingCompleted(userId: string): boolean {
  if (!userId) return false;
  try {
    return !!localStorage.getItem(onboardingCompletedKey(userId));
  } catch {
    return false;
  }
}

/** First-run prompt: skip users who already finished the older intro or this screen. */
export function shouldShowFocusGoalOnboarding(userId: string): boolean {
  if (!userId) return false;
  if (onboardingCompleted(userId)) return false;
  if (loadFocusGoalsRecord(userId)) return false;
  return true;
}

export function completeFocusGoalOnboarding(
  userId: string,
  goals: FocusGoalId[],
  skipped: boolean,
): void {
  saveFocusGoalsRecord(userId, {
    version: 1,
    goals: skipped ? [] : sanitizeFocusGoals(goals),
    skipped,
  });
  markOnboardingDone(userId);
}
