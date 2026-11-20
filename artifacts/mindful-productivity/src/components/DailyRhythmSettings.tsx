import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { isNativeApp } from "@/lib/native";
import { dailyRhythmCopyFromTranslations } from "@/lib/dailyRhythmCopy";
import {
  DAILY_RHYTHM_DEFAULTS,
  DAILY_RHYTHM_KEYS,
  applyPreferredMorningBoostTime,
  type DailyRhythmConfig,
  type DailyRhythmKey,
  loadDailyRhythmConfig,
  saveDailyRhythmConfig,
  scheduleDailyRhythmReminders,
  scheduleDailyRhythmTestNotification,
} from "@/lib/dailyRhythmNotifications";
import { resolveLocalNotificationPermission } from "@/lib/localReminderNotifications";
import { reminderService, type PermissionStatus } from "@/services/reminderService";
import { getWellnessPreferences } from "@/lib/wellness/wellnessPreferences";
import { useIntentions } from "@/hooks/useIntentions";

const HOUR_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

export function DailyRhythmSettings() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: intentions = [] } = useIntentions();
  const nativeApp = isNativeApp();

  const [config, setConfig] = useState<DailyRhythmConfig>(() => loadDailyRhythmConfig());
  const [permStatus, setPermStatus] = useState<PermissionStatus>("default");
  const [testStatus, setTestStatus] = useState<"idle" | "sent" | "failed">("idle");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const status = nativeApp
        ? await resolveLocalNotificationPermission(false)
        : await reminderService.refreshPermission();
      if (!cancelled) setPermStatus(status);

      if (user?.id) {
        try {
          const prefs = await getWellnessPreferences(user.id);
          if (!cancelled && prefs?.preferred_reminder_time) {
            setConfig((prev) => {
              if (
                prev.reminders.morningBoost.time !==
                DAILY_RHYTHM_DEFAULTS.morningBoost.time
              ) {
                return prev;
              }
              const seeded = applyPreferredMorningBoostTime(
                prev,
                prefs.preferred_reminder_time,
              );
              saveDailyRhythmConfig(seeded);
              return seeded;
            });
          }
        } catch {
          // optional
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nativeApp, user?.id]);

  const persistAndSchedule = useCallback(
    async (next: DailyRhythmConfig, requestPermission = false) => {
      setConfig(next);
      saveDailyRhythmConfig(next);
      if (!nativeApp) return;
      const ok = await scheduleDailyRhythmReminders({
        config: next,
        copy: dailyRhythmCopyFromTranslations(t),
        requestPermission,
        intentions,
      });
      if (next.masterEnabled && !ok) {
        const status = await resolveLocalNotificationPermission(false);
        setPermStatus(status);
      } else if (ok) {
        setPermStatus("granted");
      }
    },
    [intentions, nativeApp, t],
  );

  const update = (patch: Partial<DailyRhythmConfig>) => {
    void persistAndSchedule({ ...config, ...patch });
  };

  const updateReminder = (
    key: DailyRhythmKey,
    patch: Partial<DailyRhythmConfig["reminders"][DailyRhythmKey]>,
  ) => {
    void persistAndSchedule({
      ...config,
      reminders: {
        ...config.reminders,
        [key]: { ...config.reminders[key], ...patch },
      },
    });
  };

  const handleMasterToggle = async () => {
    if (config.masterEnabled) {
      await persistAndSchedule({ ...config, masterEnabled: false });
      return;
    }
    if (nativeApp) {
      const status = await resolveLocalNotificationPermission(true);
      setPermStatus(status);
      if (status !== "granted") {
        await persistAndSchedule({
          ...config,
          masterEnabled: false,
          lastDeniedPromptAt: new Date().toISOString(),
        });
        return;
      }
    }
    await persistAndSchedule({ ...config, masterEnabled: true }, true);
  };

  const handleTest = async () => {
    if (nativeApp) {
      const status = await resolveLocalNotificationPermission(true);
      setPermStatus(status);
      if (status !== "granted") {
        setTestStatus("failed");
        setTimeout(() => setTestStatus("idle"), 3000);
        return;
      }
      try {
        const copy = dailyRhythmCopyFromTranslations(t);
        const ok = await scheduleDailyRhythmTestNotification({
          title: copy.title,
          body: copy.bodies.morningBoost[0] ?? copy.title,
        });
        setTestStatus(ok ? "sent" : "failed");
      } catch {
        setTestStatus("failed");
      }
      setTimeout(() => setTestStatus("idle"), 3000);
      return;
    }
    try {
      await reminderService.showTestNotification({
        title: t("rhythm.notification.title"),
        body: t("rhythm.body.morningBoost.0"),
      });
      setTestStatus("sent");
    } catch {
      setTestStatus("failed");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  };

  const selectStyle = {
    width: "100%",
    padding: "9px 14px",
    borderRadius: 10,
    background: "#1A1E1A",
    border: "1px solid #2D3A2E",
    color: "#C8D5B9",
    fontSize: 13,
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    cursor: "pointer",
  };

  return (
    <div
      className="rounded-2xl p-4 space-y-4"
      style={{ background: "#222822", border: "1px solid #2D3A2E" }}
      data-testid="daily-rhythm-settings"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#2D3A2E" }}
        >
          {config.masterEnabled ? (
            <Bell className="w-5 h-5 text-[#C8D5B9]" />
          ) : (
            <BellOff className="w-5 h-5 text-[#7A8A72]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#E8EDE3]">{t("rhythm.section.title")}</p>
          <p className="text-xs text-[#7A8A72] mt-0.5">{t("rhythm.section.subtitle")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.masterEnabled}
          data-testid="rhythm-master-toggle"
          onClick={() => void handleMasterToggle()}
          className="relative w-11 h-6 rounded-full transition-colors shrink-0"
          style={{ background: config.masterEnabled ? "#8FA680" : "#2D3A2E" }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
            style={{ transform: config.masterEnabled ? "translateX(20px)" : "translateX(0)" }}
          />
        </button>
      </div>

      {!nativeApp && (
        <p className="text-xs text-[#7A8A72]" data-testid="rhythm-web-note">
          {t("rhythm.webNote")}
        </p>
      )}

      {permStatus === "denied" && (
        <p className="text-xs text-[#D4806A]" data-testid="rhythm-denied">
          {t(nativeApp ? "rhythm.deniedNative" : "rhythm.denied")}
        </p>
      )}

      {config.masterEnabled && (
        <>
          <div className="space-y-3">
            {DAILY_RHYTHM_KEYS.map((key) => {
              const reminder = config.reminders[key];
              const time = reminder.time || DAILY_RHYTHM_DEFAULTS[key].time;
              return (
                <div
                  key={key}
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: "#1A1E1A", border: "1px solid #2D3A2E" }}
                  data-testid={`rhythm-row-${key}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-[#C8D5B9]">{t(`rhythm.key.${key}`)}</p>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={reminder.enabled}
                      data-testid={`rhythm-toggle-${key}`}
                      onClick={() => updateReminder(key, { enabled: !reminder.enabled })}
                      className="relative w-10 h-5 rounded-full shrink-0"
                      style={{ background: reminder.enabled ? "#8FA680" : "#2D3A2E" }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                        style={{
                          transform: reminder.enabled ? "translateX(18px)" : "translateX(0)",
                        }}
                      />
                    </button>
                  </div>
                  <select
                    value={time}
                    disabled={!reminder.enabled}
                    onChange={(event) => updateReminder(key, { time: event.target.value })}
                    style={selectStyle}
                    data-testid={`rhythm-time-${key}`}
                  >
                    {!HOUR_OPTIONS.includes(time) && <option value={time}>{time}</option>}
                    {HOUR_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#7A8A72] mb-1 block">{t("rhythm.quietStart")}</label>
              <select
                value={config.quietStart}
                onChange={(event) => update({ quietStart: event.target.value })}
                style={selectStyle}
                data-testid="rhythm-quiet-start"
              >
                {HOUR_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#7A8A72] mb-1 block">{t("rhythm.quietEnd")}</label>
              <select
                value={config.quietEnd}
                onChange={(event) => update({ quietEnd: event.target.value })}
                style={selectStyle}
                data-testid="rhythm-quiet-end"
              >
                {HOUR_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleTest()}
            data-testid="rhythm-test-notification"
            className="w-full py-2.5 rounded-xl text-xs font-semibold"
            style={{
              background: "#2D3A2E",
              color: "#C8D5B9",
              border: "1px solid #3D4D35",
            }}
          >
            {testStatus === "sent"
              ? t("rhythm.testSent")
              : testStatus === "failed"
                ? t("rhythm.testFailed")
                : t("rhythm.test")}
          </button>
        </>
      )}
    </div>
  );
}
