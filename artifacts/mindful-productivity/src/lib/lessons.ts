import { Hourglass, HeartPulse, Brain, Flame, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import supabase from "./supabase";
import { getLocalLessons } from "./localLessons";
import type { LanguageCode } from "./translations";

export const CATEGORIES = [
  "procrastination",
  "anxiety",
  "cbt",
  "motivation",
  "habits",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface CategoryMeta {
  /** Translation key for the visible label, e.g. "category.procrastination" */
  labelKey: string;
  /** Kept for backward-compat: English fallback label */
  label: string;
  iconBg: string;
  iconColor: string;
  icon: LucideIcon;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  procrastination: { labelKey: "category.procrastination", label: "Procrastination", iconBg: "#3D2020", iconColor: "#D4806A", icon: Hourglass },
  anxiety:         { labelKey: "category.anxiety",         label: "Anxiety",         iconBg: "#2D2040", iconColor: "#B08AD4", icon: HeartPulse },
  cbt:             { labelKey: "category.cbt",             label: "CBT",             iconBg: "#2D3A2E", iconColor: "#8FA680", icon: Brain },
  motivation:      { labelKey: "category.motivation",      label: "Motivation",      iconBg: "#3D3520", iconColor: "#D4B96A", icon: Flame },
  habits:          { labelKey: "category.habits",          label: "Habits",          iconBg: "#1E3020", iconColor: "#7AC47A", icon: Repeat },
};

export function categoryMeta(category: string): CategoryMeta {
  return (
    CATEGORY_META[category as Category] ?? {
      labelKey: `category.${category}`,
      label: category,
      iconBg: "#1E241E",
      iconColor: "#7A8A72",
      icon: Brain,
    }
  );
}

export interface LessonRow {
  id: string;
  title: string;
  content: string;
  category: string;
  reading_time_minutes: number;
  sort_order: number;
  active: boolean;
  created_at: string;
}

/**
 * Fetch lessons for the given locale.
 *
 * - English: fetches remote Supabase lessons and supplements with local ones
 *   (existing behaviour).
 * - Indonesian / Japanese: remote micro_lessons are English-only and cannot
 *   be served in those languages, so we return only the fully-localized
 *   local catalog for those locales. No schema/database changes needed.
 */
export async function fetchLessons(lang: LanguageCode = "en"): Promise<LessonRow[]> {
  const localLessons = getLocalLessons(lang);

  // For non-English locales serve only the localized local catalog.
  if (lang !== "en") {
    return localLessons.sort((a, b) => a.sort_order - b.sort_order);
  }

  // English: fetch remote, apply overrides, then supplement with local lessons.
  const { data, error } = await supabase
    .from("micro_lessons")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const TITLE_OVERRIDES: Record<string, Partial<LessonRow>> = {
    "What Is WOOP and Why It's Better Than a To-Do List": {
      title: "The Science of Intention Setting",
      content:
        "Research shows that mentally contrasting your goal with potential obstacles dramatically improves follow-through. This technique — used by Olympic athletes and top performers — works by activating your brain's planning systems. The four steps: clarify your Wish, vividly imagine the Outcome, identify the key Obstacle, and write an if-then Plan. Studies show this approach doubles completion rates compared to positive thinking alone.",
    },
  };

  const remote = ((data ?? []) as LessonRow[]).map((lesson) =>
    TITLE_OVERRIDES[lesson.title]
      ? { ...lesson, ...TITLE_OVERRIDES[lesson.title] }
      : lesson,
  );

  // Supplement with local lessons whose IDs are not already in the remote set.
  const remoteIds = new Set(remote.map((l) => l.id));
  // Also guard by title for remote lessons that pre-date the local- prefix IDs.
  const remoteTitles = new Set(remote.map((l) => l.title));
  const extras = localLessons.filter(
    (l) => !remoteIds.has(l.id) && !remoteTitles.has(l.title),
  );

  return [...remote, ...extras].sort((a, b) => a.sort_order - b.sort_order);
}

export async function saveLessonProgress(
  userId: string,
  lessonId: string,
  helpful: boolean,
): Promise<void> {
  const { error } = await supabase.from("lesson_progress").insert([
    {
      user_id: userId,
      lesson_id: lessonId,
      read_at: new Date().toISOString(),
      helpful,
    },
  ]);

  if (error) throw error;
}
