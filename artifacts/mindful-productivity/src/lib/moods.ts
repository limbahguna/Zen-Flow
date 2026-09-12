import { Angry, Frown, Meh, Smile, Laugh } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface MoodOption {
  value: number;
  labelKey: string;
  icon: LucideIcon;
  color: string;
}

export const MOODS: MoodOption[] = [
  { value: 2, labelKey: "journal.form.mood.awful", icon: Angry, color: "#DC2626" },
  { value: 4, labelKey: "journal.form.mood.low", icon: Frown, color: "#EA580C" },
  { value: 6, labelKey: "journal.form.mood.okay", icon: Meh, color: "#D97706" },
  { value: 8, labelKey: "journal.form.mood.good", icon: Smile, color: "#0284C7" },
  { value: 10, labelKey: "journal.form.mood.great", icon: Laugh, color: "#16A34A" },
];

export function moodOption(value: number | null): MoodOption | null {
  if (value == null) return null;
  let closest = MOODS[0];
  for (const m of MOODS) {
    if (Math.abs(m.value - value) < Math.abs(closest.value - value)) closest = m;
  }
  return closest;
}
