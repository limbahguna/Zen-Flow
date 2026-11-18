import { Check } from "lucide-react";
import { FOCUS_GOAL_COPY, FOCUS_GOAL_IDS, type FocusGoalId } from "@/lib/focusGoals";
import { FocusGoalArt } from "@/components/FocusGoalArt";
import { useLanguage } from "@/context/LanguageContext";

const CARD_TONES: Record<FocusGoalId, { idle: string; selected: string; border: string; selectedBorder: string }> = {
  mood: { idle: "#243028", selected: "#2D3A2E", border: "#314034", selectedBorder: "#8FA680" },
  calm: { idle: "#222E2C", selected: "#2A3A38", border: "#314440", selectedBorder: "#7AA8A8" },
  focus: { idle: "#2A281F", selected: "#353225", border: "#3D3A2C", selectedBorder: "#D4B96A" },
  sleep: { idle: "#1E2432", selected: "#252C3C", border: "#2C3548", selectedBorder: "#7A8FB0" },
  journal: { idle: "#2A2420", selected: "#332C26", border: "#3D342C", selectedBorder: "#C4A484" },
};

interface FocusGoalPickerProps {
  selected: FocusGoalId[];
  onToggle: (id: FocusGoalId) => void;
  compact?: boolean;
}

export function FocusGoalPicker({ selected, onToggle, compact = false }: FocusGoalPickerProps) {
  const { t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t("onboarding.goals.title")}
      className={`grid grid-cols-1 gap-3 ${compact ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}
      data-testid="focus-goal-picker"
    >
      {FOCUS_GOAL_IDS.map((id) => {
        const active = selected.includes(id);
        const copy = FOCUS_GOAL_COPY[id];
        const tone = CARD_TONES[id];
        const title = t(copy.titleKey);
        const desc = t(copy.descKey);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            aria-pressed={active}
            aria-label={`${title}. ${desc}`}
            data-testid={`focus-goal-${id}`}
            className="flex w-full min-w-0 items-start gap-3 rounded-2xl border p-3 text-left transition-all duration-200 sm:p-4"
            style={{
              backgroundColor: active ? tone.selected : tone.idle,
              borderColor: active ? tone.selectedBorder : tone.border,
              boxShadow: active ? `0 0 0 1px ${tone.selectedBorder}33` : "none",
            }}
          >
            <FocusGoalArt
              goal={id}
              label={t(copy.artLabelKey)}
              className="h-14 w-[4.6rem] shrink-0 sm:h-16 sm:w-[5.2rem]"
            />
            <span className="min-w-0 flex-1 pt-0.5">
              <span className="block font-heading text-sm font-semibold leading-snug text-[#E8EDE3] text-balance sm:text-[15px]">
                {title}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-[#A3B197] sm:text-[13px]">
                {desc}
              </span>
            </span>
            <span
              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
              style={{
                backgroundColor: active ? tone.selectedBorder : "transparent",
                borderColor: active ? tone.selectedBorder : "#4A5D3E",
              }}
              aria-hidden="true"
            >
              {active && <Check className="h-3 w-3 text-[#1A1E1A]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
