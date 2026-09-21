import { FormEvent, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { t as translate } from "@/lib/translations";
import { deviceTimeZone } from "@/lib/wellness/localDate";
import {
  PREFERRED_DURATIONS,
  PRIMARY_GOALS,
  WELLNESS_LOCALES,
  type PreferredDurationMinutes,
  type PrimaryGoal,
  type WellnessLocale,
  type WellnessPreferencesInput,
} from "@/lib/wellness/types";

interface WellnessPreferencesFormProps {
  saving: boolean;
  errorMessage?: string | null;
  defaultLocale: WellnessLocale;
  onSave: (input: WellnessPreferencesInput) => void;
}

export function WellnessPreferencesForm({
  saving,
  errorMessage,
  defaultLocale,
  onSave,
}: WellnessPreferencesFormProps) {
  const { t, language } = useLanguage();
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>("stress");
  const [duration, setDuration] = useState<PreferredDurationMinutes>(5);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [timezone, setTimezone] = useState(deviceTimeZone);
  const [locale, setLocale] = useState<WellnessLocale>(defaultLocale);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({
      primary_goal: primaryGoal,
      preferred_duration_minutes: duration,
      preferred_reminder_time: reminderTime,
      timezone,
      locale,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5"
      data-testid="wellness-prefs-form"
    >
      <div>
        <h2 className="font-heading text-lg font-bold text-[#E8EDE3]">
          {t("programs.prefs.title")}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[#A3B197]">
          {t("programs.prefs.body")}
        </p>
      </div>

      <label className="block text-sm text-[#C8D5B9]">
        {t("programs.prefs.primaryGoal")}
        <select
          className="mt-1 h-11 w-full rounded-xl border border-[#2D3A2E] bg-[#141814] px-3 text-[#E8EDE3]"
          value={primaryGoal}
          onChange={(event) => setPrimaryGoal(event.target.value as PrimaryGoal)}
          data-testid="prefs-primary-goal"
        >
          {PRIMARY_GOALS.map((goal) => (
            <option key={goal} value={goal}>
              {t(`programs.goal.${goal}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-[#C8D5B9]">
        {t("programs.prefs.duration")}
        <select
          className="mt-1 h-11 w-full rounded-xl border border-[#2D3A2E] bg-[#141814] px-3 text-[#E8EDE3]"
          value={duration}
          onChange={(event) =>
            setDuration(Number(event.target.value) as PreferredDurationMinutes)
          }
          data-testid="prefs-duration"
        >
          {PREFERRED_DURATIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {translate(language, "programs.prefs.durationOption", { n: minutes })}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm text-[#C8D5B9]">
        {t("programs.prefs.reminderTime")}
        <input
          type="time"
          required
          className="mt-1 h-11 w-full rounded-xl border border-[#2D3A2E] bg-[#141814] px-3 text-[#E8EDE3]"
          value={reminderTime}
          onChange={(event) => setReminderTime(event.target.value)}
          data-testid="prefs-reminder-time"
        />
      </label>

      <label className="block text-sm text-[#C8D5B9]">
        {t("programs.prefs.timezone")}
        <input
          type="text"
          required
          className="mt-1 h-11 w-full rounded-xl border border-[#2D3A2E] bg-[#141814] px-3 text-[#E8EDE3]"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          data-testid="prefs-timezone"
        />
      </label>

      <label className="block text-sm text-[#C8D5B9]">
        {t("programs.prefs.locale")}
        <select
          className="mt-1 h-11 w-full rounded-xl border border-[#2D3A2E] bg-[#141814] px-3 text-[#E8EDE3]"
          value={locale}
          onChange={(event) => setLocale(event.target.value as WellnessLocale)}
          data-testid="prefs-locale"
        >
          {WELLNESS_LOCALES.map((code) => (
            <option key={code} value={code}>
              {t(`programs.locale.${code}`)}
            </option>
          ))}
        </select>
      </label>

      {errorMessage && (
        <p className="text-sm text-[#D4806A]" role="alert" data-testid="prefs-error">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#4A5D3E] text-sm font-medium text-[#E8EDE3] hover:bg-[#6B8C5A] disabled:opacity-60"
        aria-label={t("programs.prefs.save")}
        data-testid="prefs-save"
      >
        {saving ? t("programs.prefs.saving") : t("programs.prefs.save")}
      </button>
    </form>
  );
}
