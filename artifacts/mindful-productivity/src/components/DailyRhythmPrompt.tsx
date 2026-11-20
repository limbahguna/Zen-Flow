import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { isNativeApp } from "@/lib/native";
import { dailyRhythmCopyFromTranslations } from "@/lib/dailyRhythmCopy";
import {
  DAILY_RHYTHM_DEFAULTS,
  DAILY_RHYTHM_KEYS,
  applyPreferredMorningBoostTime,
  canShowDailyRhythmPrompt,
  loadDailyRhythmConfig,
  saveDailyRhythmConfig,
  scheduleDailyRhythmReminders,
  type DailyRhythmConfig,
} from "@/lib/dailyRhythmNotifications";
import { resolveLocalNotificationPermission } from "@/lib/localReminderNotifications";
import { useIntentions } from "@/hooks/useIntentions";
import { getWellnessPreferences } from "@/lib/wellness/wellnessPreferences";

/**
 * First-run sheet after sign-in / setup. Shown once per user+device
 * (localStorage + user_metadata.daily_rhythm_prompt_completed).
 */
export function DailyRhythmPrompt() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isProfileComplete, updateProfile } = useProfile();
  const { data: intentions = [] } = useIntentions();
  const nativeApp = isNativeApp();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<DailyRhythmConfig>(() => loadDailyRhythmConfig());

  useEffect(() => {
    if (!user?.id || !isProfileComplete) return;

    const metaDone = Boolean(user.user_metadata?.daily_rhythm_prompt_completed);
    const local = loadDailyRhythmConfig();

    if (metaDone && !local.promptCompleted) {
      const synced = { ...local, promptCompleted: true };
      saveDailyRhythmConfig(synced);
      setConfig(synced);
      return;
    }
    if (local.promptCompleted || metaDone) return;
    if (!canShowDailyRhythmPrompt(local)) return;

    let cancelled = false;
    void (async () => {
      let next = local;
      try {
        const prefs = await getWellnessPreferences(user.id);
        if (prefs?.preferred_reminder_time) {
          next = applyPreferredMorningBoostTime(local, prefs.preferred_reminder_time);
          saveDailyRhythmConfig(next);
        }
      } catch {
        // optional
      }
      if (!cancelled) {
        setConfig(next);
        setOpen(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.user_metadata?.daily_rhythm_prompt_completed, isProfileComplete]);

  async function persistPromptDone(next: DailyRhythmConfig) {
    saveDailyRhythmConfig(next);
    setConfig(next);
    try {
      await updateProfile({ daily_rhythm_prompt_completed: true });
    } catch {
      // local flag still stops nagging on this device
    }
  }

  async function handleEnable() {
    setBusy(true);
    try {
      if (nativeApp) {
        const status = await resolveLocalNotificationPermission(true);
        if (status !== "granted") {
          const denied: DailyRhythmConfig = {
            ...config,
            masterEnabled: false,
            promptCompleted: false,
            lastDeniedPromptAt: new Date().toISOString(),
          };
          saveDailyRhythmConfig(denied);
          setConfig(denied);
          setOpen(false);
          toast({ title: t("rhythm.deniedNative"), variant: "destructive" });
          return;
        }
      }

      const enabled: DailyRhythmConfig = {
        ...config,
        masterEnabled: true,
        promptCompleted: true,
        lastDeniedPromptAt: null,
      };
      saveDailyRhythmConfig(enabled);
      if (nativeApp) {
        await scheduleDailyRhythmReminders({
          config: enabled,
          copy: dailyRhythmCopyFromTranslations(t),
          requestPermission: false,
          intentions,
        });
      }
      await persistPromptDone(enabled);
      setOpen(false);
      toast({ title: t("rhythm.toast.enabled") });
    } finally {
      setBusy(false);
    }
  }

  async function handleLater() {
    await persistPromptDone({
      ...config,
      promptCompleted: true,
      masterEnabled: false,
    });
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(15,18,15,0.72)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="daily-rhythm-prompt"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="w-full max-w-md rounded-2xl p-5 space-y-4"
            style={{ background: "#1A1E1A", border: "1px solid #2D3A2E" }}
          >
            <div>
              <h2 className="text-lg font-semibold text-[#E8EDE3]">{t("rhythm.prompt.title")}</h2>
              <p className="text-sm text-[#7A8A72] mt-1">{t("rhythm.prompt.body")}</p>
            </div>

            {!nativeApp && (
              <p className="text-xs text-[#A3B197]">{t("rhythm.webNote")}</p>
            )}

            <ul className="space-y-2">
              {DAILY_RHYTHM_KEYS.map((key) => (
                <li
                  key={key}
                  className="flex items-center justify-between text-sm text-[#C8D5B9] rounded-xl px-3 py-2"
                  style={{ background: "#222822" }}
                >
                  <span>{t(`rhythm.key.${key}`)}</span>
                  <span className="text-[#7A8A72] tabular-nums">
                    {config.reminders[key].time || DAILY_RHYTHM_DEFAULTS[key].time}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleEnable()}
                data-testid="rhythm-prompt-enable"
                className="w-full h-11 rounded-xl text-sm font-bold"
                style={{ background: "#C8D5B9", color: "#0F120F" }}
              >
                {t("rhythm.prompt.enable")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleLater()}
                data-testid="rhythm-prompt-later"
                className="w-full h-11 rounded-xl text-sm"
                style={{ background: "transparent", color: "#7A8A72", border: "1px solid #2D3A2E" }}
              >
                {t("rhythm.prompt.later")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
