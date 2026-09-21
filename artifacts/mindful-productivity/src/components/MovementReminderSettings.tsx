/**
 * MovementReminderSettings — settings card for the Profile page.
 *
 * Covers:
 *   - Enable/disable toggle
 *   - Reminder time (HH:MM)
 *   - Active days (Su–Sa)
 *   - Duration (5 / 10 / 15 min)
 *   - Movement type (stretch / walk / desk / free)
 *   - Quiet hours (start / end)
 *   - Test notification button
 *
 * Permission is only requested when user presses Enable or Test Notification.
 * Permission denial is handled gracefully (no crash, helpful message shown).
 * All text is localised through LanguageContext.
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { PersonStanding, Bell, BellOff, Info } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { isNativeApp } from "@/lib/native";
import {
  reminderService,
  loadMovementConfig,
  saveMovementConfig,
  movementReminderCopy,
  type ReminderConfig,
  type PermissionStatus,
} from "@/services/reminderService";

const DAY_KEYS = [
  "profile.movement.days.sun",
  "profile.movement.days.mon",
  "profile.movement.days.tue",
  "profile.movement.days.wed",
  "profile.movement.days.thu",
  "profile.movement.days.fri",
  "profile.movement.days.sat",
] as const;

const DURATION_OPTIONS: Array<5 | 10 | 15> = [5, 10, 15];
const TYPE_OPTIONS: Array<ReminderConfig["type"]> = ["stretch", "walk", "desk", "free"];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  String(h).padStart(2, "0") + ":00"
);

interface Props {
  /** Called after user presses "Start now" on the in-app banner */
  onStartSession?: () => void;
}

export function MovementReminderSettings({ onStartSession }: Props) {
  const { t } = useLanguage();
  const nativeApp = isNativeApp();

  const [config, setConfig] = useState<ReminderConfig>(() => loadMovementConfig());
  const [permStatus, setPermStatus] = useState<PermissionStatus>(() =>
    reminderService.getPermissionStatus()
  );
  const [testStatus, setTestStatus] = useState<"idle" | "sent" | "failed">("idle");
  const [showBanner, setShowBanner] = useState(false);
  const [snoozeUntil, setSnoozeUntil] = useState<Date | null>(null);

  useEffect(() => {
    reminderService.setBannerCallback(() => setShowBanner(true));
    return () => reminderService.setBannerCallback(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const status = await reminderService.refreshPermission();
      if (cancelled) return;
      setPermStatus(status);
      if (nativeApp && status === "denied") {
        setConfig((prev) => (prev.enabled ? { ...prev, enabled: false } : prev));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nativeApp]);

  useEffect(() => {
    saveMovementConfig(config);
    let cancelled = false;
    void (async () => {
      if (config.enabled && permStatus === "granted") {
        const scheduled = await reminderService.scheduleReminder(
          config,
          movementReminderCopy(config, t),
        );
        if (!cancelled && !scheduled) {
          const status = await reminderService.refreshPermission();
          setPermStatus(status);
          setConfig((prev) => (prev.enabled ? { ...prev, enabled: false } : prev));
        }
      } else {
        await reminderService.cancelReminder();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config, permStatus, t]);

  const update = useCallback((patch: Partial<ReminderConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleToggleEnable = async () => {
    if (config.enabled) {
      update({ enabled: false });
      return;
    }
    const status = await reminderService.requestPermission();
    setPermStatus(status);
    if (status !== "granted") {
      update({ enabled: false });
      return;
    }
    update({ enabled: true });
  };

  const handleTestNotification = async () => {
    const status = await reminderService.requestPermission();
    setPermStatus(status);
    if (status === "denied" || status === "unsupported") {
      if (config.enabled) update({ enabled: false });
      setTestStatus("failed");
      setTimeout(() => setTestStatus("idle"), 3000);
      return;
    }
    try {
      await reminderService.showTestNotification(movementReminderCopy(config, t));
      setTestStatus("sent");
    } catch {
      setTestStatus("failed");
    }
    setTimeout(() => setTestStatus("idle"), 3000);
  };

  const handleToggleDay = (dayIdx: number) => {
    const days = config.days.includes(dayIdx)
      ? config.days.filter((d) => d !== dayIdx)
      : [...config.days, dayIdx].sort();
    update({ days });
  };

  const handleSnooze = () => {
    const fireAt = reminderService.snoozeReminder(movementReminderCopy(config, t));
    setSnoozeUntil(fireAt);
    setShowBanner(false);
  };

  const selectStyle = {
    width: "100%", padding: "9px 14px", borderRadius: 10,
    background: "#1A1E1A", border: "1px solid #2D3A2E",
    color: "#C8D5B9", fontSize: 13, appearance: "none" as const,
    WebkitAppearance: "none" as const, cursor: "pointer",
  };

  return (
    <>
      {/* ── In-app reminder banner ──────────────────────────────────── */}
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          data-testid="movement-reminder-banner"
          style={{
            position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
            zIndex: 60, width: "calc(100% - 32px)", maxWidth: 420,
            background: "#2D3A2E", borderRadius: 16, padding: 16,
            border: "1px solid #3D4D35",
          }}
        >
          <p className="text-sm font-semibold text-[#E8EDE3] mb-1">
            {t("reminder.banner.title")}
          </p>
          <p className="text-xs text-[#A3B197] mb-3">
            {t("reminder.banner.body")
              .replace("{duration}", String(config.duration))
              .replace("{type}", t(`profile.movement.type.${config.type}` as Parameters<typeof t>[0]))}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowBanner(false); onStartSession?.(); }}
              data-testid="banner-start-now"
              className="flex-1 py-2 rounded-xl bg-[#C8D5B9] text-[#0F120F] text-xs font-bold"
            >
              {t("reminder.banner.startNow")}
            </button>
            <button
              onClick={handleSnooze}
              data-testid="banner-snooze"
              className="flex-1 py-2 rounded-xl bg-[#222822] border border-[#2D3A2E] text-[#7A8A72] text-xs"
            >
              {t("reminder.banner.snooze")}
            </button>
            <button
              onClick={() => setShowBanner(false)}
              data-testid="banner-skip"
              className="flex-1 py-2 rounded-xl bg-[#222822] border border-[#2D3A2E] text-[#7A8A72] text-xs"
            >
              {t("reminder.banner.skipToday")}
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Settings card ───────────────────────────────────────────── */}
      <div
        data-testid="movement-reminder-settings"
        style={{
          background: "#222822", borderRadius: 16, padding: 16,
          border: "0.5px solid #2D3A2E",
        }}
      >
        {/* Card header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "#1E2D1E", display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <PersonStanding className="w-5 h-5" style={{ color: "#8FA680" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#E8EDE3" }}>
              {t("profile.movement.title")}
            </p>
            <p style={{ fontSize: 12, color: "#7A8A72" }}>
              {t("profile.movement.subtitle")}
            </p>
          </div>
          {/* Enable toggle */}
          <button
            onClick={handleToggleEnable}
            data-testid="movement-enable-toggle"
            aria-pressed={config.enabled}
            style={{
              width: 44, height: 26, borderRadius: 13, border: "none",
              background: config.enabled ? "#3D4D35" : "#2D3A2E",
              position: "relative", cursor: "pointer", flexShrink: 0,
              transition: "background 0.2s",
            }}
          >
            <span style={{
              position: "absolute", top: 3,
              left: config.enabled ? 21 : 3,
              width: 20, height: 20, borderRadius: "50%",
              background: config.enabled ? "#C8D5B9" : "#7A8A72",
              transition: "left 0.2s, background 0.2s",
            }} />
          </button>
        </div>

        {/* Notification status messages */}
        {permStatus === "unsupported" && (
          <div className="flex gap-2 bg-[#1E2A1E] rounded-xl p-3 mb-3">
            <Info className="w-4 h-4 text-[#7A8A72] shrink-0 mt-0.5" />
            <p className="text-xs text-[#7A8A72]">{t("profile.movement.unsupported")}</p>
          </div>
        )}
        {permStatus === "denied" && (
          <div className="flex gap-2 bg-[#2D2420] rounded-xl p-3 mb-3">
            <BellOff className="w-4 h-4 text-[#D4806A] shrink-0 mt-0.5" />
            <p className="text-xs text-[#D4806A]">
              {t(nativeApp ? "profile.movement.deniedNative" : "profile.movement.denied")}
            </p>
          </div>
        )}

        {/* Settings (shown when enabled or always editable) */}
        <div className="space-y-3" style={{ opacity: config.enabled ? 1 : 0.55 }}>
          {/* Reminder time */}
          <div>
            <label className="block text-xs text-[#7A8A72] mb-1">{t("profile.movement.time")}</label>
            <input
              type="time"
              value={config.time}
              onChange={(e) => update({ time: e.target.value })}
              data-testid="movement-time-input"
              style={{
                ...selectStyle,
                colorScheme: "dark",
              }}
            />
          </div>

          {/* Active days */}
          <div>
            <label className="block text-xs text-[#7A8A72] mb-2">{t("profile.movement.days")}</label>
            <div className="flex gap-1.5">
              {DAY_KEYS.map((key, i) => (
                <button
                  key={i}
                  onClick={() => handleToggleDay(i)}
                  data-testid={`movement-day-${i}`}
                  aria-pressed={config.days.includes(i)}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 11,
                    fontWeight: 500, border: "1px solid",
                    background: config.days.includes(i) ? "#3D4D35" : "#1A1E1A",
                    borderColor: config.days.includes(i) ? "#4D6040" : "#2D3A2E",
                    color: config.days.includes(i) ? "#C8D5B9" : "#7A8A72",
                    cursor: "pointer",
                  }}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs text-[#7A8A72] mb-1">{t("profile.movement.duration")}</label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => update({ duration: d })}
                  data-testid={`movement-dur-${d}`}
                  aria-pressed={config.duration === d}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12,
                    fontWeight: 500, border: "1px solid",
                    background: config.duration === d ? "#3D4D35" : "#1A1E1A",
                    borderColor: config.duration === d ? "#4D6040" : "#2D3A2E",
                    color: config.duration === d ? "#C8D5B9" : "#7A8A72",
                    cursor: "pointer",
                  }}
                >
                  {t(`profile.movement.dur.${d}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </div>

          {/* Movement type */}
          <div>
            <label className="block text-xs text-[#7A8A72] mb-1">{t("profile.movement.type")}</label>
            <select
              value={config.type}
              onChange={(e) => update({ type: e.target.value as ReminderConfig["type"] })}
              data-testid="movement-type-select"
              style={selectStyle}
            >
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {t(`profile.movement.type.${type}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
          </div>

          {/* Quiet hours */}
          <div>
            <label className="block text-xs text-[#7A8A72] mb-1">
              {t("profile.movement.quietStart")} / {t("profile.movement.quietEnd")}
            </label>
            <div className="flex gap-2">
              <select
                value={config.quietStart}
                onChange={(e) => update({ quietStart: e.target.value })}
                data-testid="movement-quiet-start"
                style={{ ...selectStyle, flex: 1 }}
              >
                {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <select
                value={config.quietEnd}
                onChange={(e) => update({ quietEnd: e.target.value })}
                data-testid="movement-quiet-end"
                style={{ ...selectStyle, flex: 1 }}
              >
                {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Test notification */}
        <button
          onClick={handleTestNotification}
          data-testid="movement-test-notification"
          disabled={testStatus !== "idle"}
          style={{
            width: "100%", marginTop: 14, padding: "10px 0",
            borderRadius: 12, border: "1px solid #2D3A2E",
            background: testStatus === "sent" ? "#2D3A2E" : "#1A1E1A",
            color: testStatus === "sent" ? "#C8D5B9" : testStatus === "failed" ? "#D4806A" : "#7A8A72",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <Bell className="w-4 h-4" />
          {testStatus === "sent"
            ? t(nativeApp ? "profile.movement.testScheduled" : "profile.movement.testSent")
            : testStatus === "failed"
            ? t("profile.movement.testFailed")
            : t("profile.movement.test")}
        </button>

        {snoozeUntil && (
          <p className="text-center text-xs text-[#7A8A72] mt-2">
            ⏰ {snoozeUntil.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}

        {/* Background limitation notice */}
        <div className="flex gap-2 mt-3">
          <Info className="w-3.5 h-3.5 text-[#4D5D45] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#4D5D45] leading-relaxed">
          {t(nativeApp ? "reminder.banner.backgroundNative" : "reminder.banner.background")}
          </p>
        </div>
      </div>
    </>
  );
}
