import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { FocusGoalPicker } from "@/components/FocusGoalPicker";
import {
  completeFocusGoalOnboarding,
  type FocusGoalId,
} from "@/lib/focusGoals";

export { onboardingCompleted, shouldShowFocusGoalOnboarding } from "@/lib/focusGoals";

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selected, setSelected] = useState<FocusGoalId[]>([]);

  function toggle(id: FocusGoalId) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function finish(skipped: boolean) {
    if (user?.id) {
      completeFocusGoalOnboarding(user.id, selected, skipped);
    }
    onComplete();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#1A1E1A] px-4 py-6 sm:px-6"
      data-testid="onboarding-flow"
      role="dialog"
      aria-labelledby="focus-goals-title"
      aria-describedby="focus-goals-subtitle"
    >
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          <div className="mx-auto max-w-lg space-y-2 text-center">
            <h1
              id="focus-goals-title"
              className="font-heading text-2xl font-bold text-balance text-[#E8EDE3] sm:text-[1.7rem]"
            >
              {t("onboarding.goals.title")}
            </h1>
            <p id="focus-goals-subtitle" className="text-sm leading-relaxed text-[#A3B197] text-balance">
              {t("onboarding.goals.subtitle")}
            </p>
            <p className="text-xs leading-relaxed text-[#7A8A72]">
              {t("onboarding.goals.privacy")}
            </p>
          </div>

          <div className="mt-5">
            <FocusGoalPicker selected={selected} onToggle={toggle} />
          </div>
        </div>

        <div
          className="onboarding-bottom-actions flex shrink-0 flex-col gap-3 pt-2"
          data-testid="onboarding-bottom-actions"
        >
          <button
            type="button"
            onClick={() => finish(false)}
            disabled={selected.length === 0}
            className="h-12 w-full rounded-xl bg-[#4A5D3E] text-sm font-medium text-[#E8EDE3] transition-colors hover:bg-[#6B8C5A] disabled:cursor-not-allowed disabled:bg-[#222822] disabled:text-[#7A8A72]"
            data-testid="button-onboarding-continue"
          >
            {t("onboarding.continue")}
          </button>
          <button
            type="button"
            onClick={() => finish(true)}
            className="h-10 w-full text-sm text-[#7A8A72] transition-colors hover:text-[#A3B197]"
            data-testid="button-onboarding-skip"
          >
            {t("onboarding.skipForNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
