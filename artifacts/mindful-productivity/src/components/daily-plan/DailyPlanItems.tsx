import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { t as translate } from "@/lib/translations";
import { PRACTICE_CONTENT_KEYS } from "@/lib/wellness/programCatalog";
import type { DailyActivity, DailyPlanItem, PracticeKind } from "@/lib/wellness/types";

const REFLECTION_MAX = 2000;

interface ItemShellProps {
  item: DailyPlanItem;
  completed: boolean;
  children: ReactNode;
}

function ItemShell({ item, completed, children }: ItemShellProps) {
  const { t } = useLanguage();
  return (
    <article
      className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5"
      data-testid={`daily-plan-item-${item.item_key}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">
          {item.required ? t("dailyPlan.item.required") : t("dailyPlan.item.optional")}
        </p>
        {completed && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-[#7AC47A]"
            data-testid={`daily-plan-item-done-${item.item_key}`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {t("dailyPlan.item.completed")}
          </span>
        )}
      </div>
      {children}
    </article>
  );
}

export function MoodCheckInItem({
  item,
  activity,
  saving,
  disabled,
  onSave,
}: {
  item: DailyPlanItem;
  activity: DailyActivity | null;
  saving: boolean;
  disabled: boolean;
  onSave: (score: number) => void;
}) {
  const { t, language } = useLanguage();
  const completed = Boolean(activity);
  return (
    <ItemShell item={item} completed={completed}>
      <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("dailyPlan.mood.title")}</h2>
      <p className="mt-1 text-sm text-[#A3B197]">{t("dailyPlan.mood.body")}</p>
      <div className="mt-4 flex gap-2" role="group" aria-label={t("dailyPlan.mood.title")}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            disabled={saving || disabled || completed}
            onClick={() => onSave(score)}
            aria-label={translate(language, "dailyPlan.mood.score", { n: score })}
            aria-pressed={activity?.mood_score === score}
            data-testid={`daily-plan-mood-${score}`}
            className={`h-11 flex-1 rounded-xl border text-sm font-semibold ${
              activity?.mood_score === score
                ? "border-[#8FA680] bg-[#2D3A2E] text-[#E8EDE3]"
                : "border-[#2D3A2E] bg-[#141814] text-[#C8D5B9]"
            } disabled:opacity-60`}
          >
            {score}
          </button>
        ))}
      </div>
    </ItemShell>
  );
}

export function DailyInsightItem({
  item,
  completed,
  saving,
  disabled,
  onOpen,
  onMarkRead,
  reason,
}: {
  item: DailyPlanItem;
  completed: boolean;
  saving: boolean;
  disabled: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
  reason?: string | null;
}) {
  const { t } = useLanguage();
  return (
    <ItemShell item={item} completed={completed}>
      <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("dailyPlan.insight.title")}</h2>
      {reason && (
        <p className="mt-1 text-sm text-[#A3B197]" data-testid="daily-plan-insight-reason">
          {reason}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-[#3D4D35] text-sm font-medium text-[#C8D5B9]"
          data-testid="daily-plan-open-insight"
        >
          {t("dailyPlan.item.openLesson")}
        </button>
        <button
          type="button"
          onClick={onMarkRead}
          disabled={saving || disabled || completed}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#4A5D3E] text-sm font-medium text-[#E8EDE3] disabled:opacity-60"
          data-testid="daily-plan-mark-insight"
        >
          {saving ? t("dailyPlan.item.saving") : t("dailyPlan.item.markRead")}
        </button>
      </div>
    </ItemShell>
  );
}

export function PracticeItem({
  item,
  completed,
  saving,
  disabled,
  onOpen,
  onComplete,
}: {
  item: Extract<DailyPlanItem, { item_key: "program_practice" }>;
  completed: boolean;
  saving: boolean;
  disabled: boolean;
  onOpen: (kind: PracticeKind) => void;
  onComplete: () => void;
}) {
  const { t } = useLanguage();
  return (
    <ItemShell item={item} completed={completed}>
      <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("dailyPlan.practice.title")}</h2>
      <p className="mt-1 text-sm text-[#A3B197]">{t(PRACTICE_CONTENT_KEYS[item.practice_kind])}</p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onOpen(item.practice_kind)}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-[#3D4D35] text-sm font-medium text-[#C8D5B9]"
          data-testid="daily-plan-open-practice"
        >
          {t("dailyPlan.item.openPractice")}
        </button>
        <button
          type="button"
          onClick={onComplete}
          disabled={saving || disabled || completed}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#4A5D3E] text-sm font-medium text-[#E8EDE3] disabled:opacity-60"
          data-testid="daily-plan-complete-practice"
        >
          {saving ? t("dailyPlan.item.saving") : t("dailyPlan.item.markComplete")}
        </button>
      </div>
    </ItemShell>
  );
}

export function ReflectionItem({
  item,
  activity,
  saving,
  disabled,
  onSave,
}: {
  item: DailyPlanItem;
  activity: DailyActivity | null;
  saving: boolean;
  disabled: boolean;
  onSave: (text: string | null) => void;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState(activity?.reflection_text ?? "");
  const completed = Boolean(activity);
  const promptKey = "practice_content_key" in item ? undefined : item.reflection_content_key;

  return (
    <ItemShell item={item} completed={completed}>
      <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">{t("dailyPlan.reflection.title")}</h2>
      <p className="mt-1 text-sm text-[#A3B197]">
        {t(promptKey || "programs.reflection.prompt")}
      </p>
      <label className="mt-3 block text-sm text-[#C8D5B9]">
        <span className="sr-only">{t("dailyPlan.reflection.title")}</span>
        <textarea
          value={text}
          maxLength={REFLECTION_MAX}
          disabled={saving || disabled || completed}
          onChange={(event) => setText(event.target.value.slice(0, REFLECTION_MAX))}
          placeholder={t("dailyPlan.reflection.placeholder")}
          className="mt-1 min-h-24 w-full rounded-xl border border-[#2D3A2E] bg-[#141814] p-3 text-sm text-[#E8EDE3]"
          data-testid="daily-plan-reflection"
        />
      </label>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onSave(text.trim() || null)}
          disabled={saving || disabled || completed}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#4A5D3E] text-sm font-medium text-[#E8EDE3] disabled:opacity-60"
          data-testid="daily-plan-save-reflection"
        >
          {saving ? t("dailyPlan.item.saving") : t("dailyPlan.item.saveReflection")}
        </button>
        {!item.required && (
          <button
            type="button"
            onClick={() => onSave(null)}
            disabled={saving || disabled || completed}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#2D3A2E] text-sm font-medium text-[#A3B197] disabled:opacity-60"
            data-testid="daily-plan-skip-reflection"
          >
            {t("dailyPlan.item.skipReflection")}
          </button>
        )}
      </div>
    </ItemShell>
  );
}
