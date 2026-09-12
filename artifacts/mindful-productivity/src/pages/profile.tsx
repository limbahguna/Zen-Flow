import { useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { LogOut, ListChecks, CheckCircle2, NotebookPen, HeartPulse, Timer, Shield, FileText, Phone, Moon, Trash2, Sparkles, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MovementReminderSettings } from "@/components/MovementReminderSettings";
import { MovementSession } from "@/components/MovementSession";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTasks } from "@/hooks/useTasks";
import { useJournal } from "@/hooks/useJournal";
import { useAnxietyChecks } from "@/hooks/useAnxietyChecks";
import { currentStreak } from "@/lib/insights";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGE_OPTIONS } from "@/lib/translations";
import { useState } from "react";

function formatDate(iso: string | undefined, lang: string): string {
  if (!iso) return "—";
  try {
    const locale = lang === "ja" ? "ja-JP" : lang === "id" ? "id-ID" : "en-US";
    return new Date(iso).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });
  }
  catch { return "—"; }
}

function useCountUp(target: number, duration = 600) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #2D3A2E 0%, #1E3020 100%)",
  "linear-gradient(135deg, #2D2040 0%, #1E1A2D 100%)",
  "linear-gradient(135deg, #3D3520 0%, #2D2818 100%)",
  "linear-gradient(135deg, #1A2A2E 0%, #0F1F22 100%)",
  "linear-gradient(135deg, #2D2420 0%, #1E1810 100%)",
];

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { displayName, updateProfile } = useProfile();
  const [, setLocation] = useLocation();
  const { language, setLanguage, t } = useLanguage();

  const { data: tasks }   = useTasks();
  const { data: entries } = useJournal();
  const { data: checks }  = useAnxietyChecks();

  const totalTasks        = tasks?.length ?? 0;
  const completedTasks    = useMemo(() => (tasks ?? []).filter(tk => tk.status === "done" || tk.status === "completed").length, [tasks]);
  const totalEntries      = entries?.length ?? 0;
  const streak            = useMemo(() => currentStreak(tasks ?? []), [tasks]);
  const breathingSessions = useMemo(() => (checks ?? []).filter(c => c.breathing_completed).length, [checks]);

  const [bedtime, setBedtime] = useState(() => {
    try { return localStorage.getItem("mindful_bedtime") ?? ""; } catch { return ""; }
  });
  const [movementSessionOpen, setMovementSessionOpen] = useState(false);

  const windDownCount = useMemo(() => {
    try { return (JSON.parse(localStorage.getItem("winddown_sessions") ?? "[]") as object[]).length; }
    catch { return 0; }
  }, []);

  const focusSessions = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("focus_sessions") ?? "[]") as { duration: number }[]; }
    catch { return []; }
  }, []);
  const focusSessionCount = focusSessions.length;
  const focusMinutes      = useMemo(() => focusSessions.reduce((s, f) => s + (f.duration ?? 0), 0), [focusSessions]);

  const moodTrendText = useMemo(() => {
    if (!checks || checks.length === 0) return null;
    const now = new Date();
    const thisStart = new Date(now); thisStart.setDate(now.getDate() - 6); thisStart.setHours(0, 0, 0, 0);
    const lastStart = new Date(thisStart); lastStart.setDate(lastStart.getDate() - 7);
    const thisWeek = checks.filter(c => new Date(c.created_at) >= thisStart);
    const lastWeek = checks.filter(c => { const d = new Date(c.created_at); return d >= lastStart && d < thisStart; });
    if (thisWeek.length === 0) return null;
    const avgThis = (thisWeek.reduce((s, c) => s + ((c as any).anxiety_level ?? 5), 0) / thisWeek.length).toFixed(1);
    if (lastWeek.length === 0) return t("profile.mood.thisWeek").replace("{avg}", avgThis);
    const avgLast = (lastWeek.reduce((s, c) => s + ((c as any).anxiety_level ?? 5), 0) / lastWeek.length).toFixed(1);
    const diff = parseFloat(avgThis) - parseFloat(avgLast);
    if (diff < -0.5) return t("profile.mood.down").replace("{avg}", avgThis).replace("{prev}", avgLast);
    if (diff > 0.5)  return t("profile.mood.up").replace("{avg}", avgThis).replace("{prev}", avgLast);
    return t("profile.mood.steady").replace("{avg}", avgThis);
  }, [checks, t]);

  // Avatar initial + gradient
  const initials = (displayName || user?.email || "?").charAt(0).toUpperCase();
  const charCode  = initials.charCodeAt(0);
  const avatarGradient = AVATAR_GRADIENTS[charCode % AVATAR_GRADIENTS.length];

  return (
    <motion.div
      className="min-h-screen bg-background pb-24"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
    >
      <header className="bg-[#141814]/90 backdrop-blur-md border-b border-[#2D3A2E] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center">
          <h1 className="font-heading font-bold text-lg text-[#E8EDE3]">{t("profile.title")}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8 space-y-5">

        {/* ── Avatar hero ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center pt-2 pb-4">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="w-24 h-24 rounded-full flex items-center justify-center mb-4 shadow-lg"
            style={{ background: avatarGradient, border: "3px solid rgba(143,166,128,0.3)" }}
            data-testid="profile-avatar"
          >
            <span className="font-heading font-bold text-4xl text-[#E8EDE3]">{initials}</span>
          </motion.div>
          <p className="font-heading font-bold text-2xl text-[#E8EDE3]" data-testid="profile-name">
            {displayName || user?.email?.split("@")[0] || "User"}
          </p>
          <p className="text-sm text-[#7A8A72] mt-1" data-testid="profile-email">{user?.email}</p>
          <p className="text-xs text-[#7A8A72] mt-1" data-testid="profile-member-since">
            {t("profile.memberSince")} {formatDate(user?.created_at, language)}
          </p>
        </div>

        {/* ── 2×2 stats grid ──────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3">
          <AchievementStat icon={ListChecks}   label={t("profile.stat.created")}   value={totalTasks}        color="#8FA680" testId="profile-stat-created"   />
          <AchievementStat icon={CheckCircle2} label={t("profile.stat.completed")} value={completedTasks}    color="#7AC47A" testId="profile-stat-completed" />
          <AchievementStat icon={NotebookPen}  label={t("profile.stat.entries")}   value={totalEntries}      color="#B08AD4" testId="profile-stat-entries"   />
          <AchievementStat icon={HeartPulse}   label={t("profile.stat.breathing")} value={breathingSessions} color="#5BB8B8" testId="profile-stat-breathing" />
          <AchievementStat icon={Timer}        label={t("profile.stat.focus")}      value={focusSessionCount} color="#D4B96A" testId="profile-stat-focus"     />
          <AchievementStat icon={Timer}        label={t("profile.stat.focusMins")} value={focusMinutes}      color="#D4B96A" testId="profile-stat-focus-mins" />
          <AchievementStat icon={Moon}         label={t("profile.stat.winddown")}  value={windDownCount}     color="#B08AD4" testId="profile-stat-winddown"  />
        </section>

        {/* ── Streak display ───────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", background: "#222822",
          borderRadius: 12, border: "0.5px solid #2D3A2E",
        }} data-testid="profile-streak">
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: streak > 0 ? "#2D3A2E" : "#1E241E",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
          }}>
            {streak === 0 ? "🌰" : streak < 7 ? "🌱" : streak < 14 ? "🌿" : streak < 30 ? "🪴" : "🌳"}
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 15, fontWeight: 500, color: "#E8EDE3" }}>
              {streak === 0
                ? t("profile.streak.start")
                : t("profile.streak.days").replace("{n}", String(streak))}
            </p>
            <p style={{ fontSize: 12, color: "#7A8A72", marginTop: 2 }}>
              {streak === 0
                ? t("profile.streak.startCta")
                : streak < 7
                ? t("profile.streak.keepGoing")
                : streak < 30
                ? t("profile.streak.milestone").replace("{n}", String(30 - streak))
                : t("profile.streak.incredible")}
            </p>
          </div>
          {streak >= 7 && (
            <div style={{ fontSize: 11, color: "#8FA680", background: "#1E3020", padding: "4px 8px", borderRadius: 999, flexShrink: 0 }}>
              {streak >= 30 ? "🌳 Tree" : streak >= 14 ? "🌿 Sprout" : "🌱 Seedling"}
            </div>
          )}
        </div>

        {/* ── Mood trend ───────────────────────────────────────────────── */}
        <div className="bg-[#222822] rounded-2xl border border-[#2D3A2E] p-5" data-testid="profile-mood-trend">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7A8A72] mb-2">{t("profile.yourGrowth")}</p>
          <p className="text-sm text-[#A3B197] leading-relaxed">
            {moodTrendText ?? t("profile.noData")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setLocation("/plans")}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#2D3A2E] bg-[#222822] p-4 text-left transition-colors hover:bg-[#2A332A]"
          data-testid="profile-plans-link"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#302A1C]">
            <Sparkles className="h-5 w-5 text-[#D4B96A]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#E8EDE3]">{t("profile.plans")}</p>
            <p className="mt-1 text-xs text-[#7A8A72]">{t("profile.plansSubtitle")}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#7A8A72]" />
        </button>

        {/* ── Language ────────────────────────────────────────────────── */}
        <div style={{
          background: "#222822", borderRadius: 16, padding: 16,
          border: "0.5px solid #2D3A2E",
        }} data-testid="profile-language">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "#2D3A2E", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 18 }}>🌐</span>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#E8EDE3" }}>{t("profile.language")}</p>
              <p style={{ fontSize: 12, color: "#7A8A72" }}>{t("profile.languageSubtitle")}</p>
            </div>
          </div>
          <select
            value={language}
            onChange={(e) => {
              const nextLanguage = e.target.value as typeof language;
              setLanguage(nextLanguage);
              void updateProfile({ language: nextLanguage });
              try { localStorage.removeItem("coach_chat_history"); } catch {}
            }}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              background: "#1A1E1A", border: "1px solid #2D3A2E",
              color: "#C8D5B9", fontSize: 14, appearance: "none",
              WebkitAppearance: "none", cursor: "pointer",
            }}
            data-testid="language-select"
          >
            {LANGUAGE_OPTIONS.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.flag} {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Bedtime Reminder ────────────────────────────────────────── */}
        <div style={{
          background: "#222822", borderRadius: 16, padding: 16,
          border: "0.5px solid #2D3A2E",
        }} data-testid="profile-bedtime">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "#2D2040", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 18 }}>🌙</span>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#E8EDE3" }}>{t("profile.bedtime")}</p>
              <p style={{ fontSize: 12, color: "#7A8A72" }}>{t("profile.bedtimeSubtitle")}</p>
            </div>
          </div>
          <select
            value={bedtime}
            onChange={(e) => {
              setBedtime(e.target.value);
              try { localStorage.setItem("mindful_bedtime", e.target.value); } catch {}
            }}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              background: "#1A1E1A", border: "1px solid #2D3A2E",
              color: "#C8D5B9", fontSize: 14, appearance: "none",
              WebkitAppearance: "none", cursor: "pointer",
            }}
          >
            <option value="">{t("common.notSet")}</option>
            <option value="21">9:00 PM</option>
            <option value="21.5">9:30 PM</option>
            <option value="22">10:00 PM</option>
            <option value="22.5">10:30 PM</option>
            <option value="23">11:00 PM</option>
            <option value="23.5">11:30 PM</option>
            <option value="0">12:00 AM</option>
          </select>
        </div>

        {/* ── Movement Reminder ───────────────────────────────────────── */}
        <MovementReminderSettings onStartSession={() => setMovementSessionOpen(true)} />

        {/* ── Sign out ────────────────────────────────────────────────── */}
        <motion.button
          onClick={signOut}
          className="w-full h-12 rounded-xl border border-[#2D3A2E] bg-transparent text-[#D4806A] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#2D2420] transition-colors duration-300"
          data-testid="button-logout"
          whileTap={{ scale: 0.98 }}
        >
          <LogOut className="w-4 h-4" /> {t("profile.signOut")}
        </motion.button>

        {/* ── Danger Zone ─────────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid #3D2020" }}
          data-testid="profile-danger-zone"
        >
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ background: "#1E1515" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A3796A" }}>
              {t("delete.dangerZone.title")}
            </p>
          </div>
          <div className="px-4 py-4" style={{ background: "#191212" }}>
            <p className="text-xs text-[#7A6A6A] mb-3 leading-relaxed">
              {t("delete.dangerZone.subtitle")}
            </p>
            <motion.button
              onClick={() => setLocation("/delete-account")}
              className="w-full h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-300"
              style={{
                background: "#2D1A1A",
                color: "#D4806A",
                border: "1px solid #4D2A2A",
              }}
              whileTap={{ scale: 0.98 }}
              data-testid="button-delete-account"
            >
              <Trash2 className="w-4 h-4" /> {t("delete.btn.deleteAccount")}
            </motion.button>
          </div>
        </div>

        {/* ── Links ───────────────────────────────────────────────────── */}
        <div className="bg-[#222822] rounded-2xl border border-[#2D3A2E] overflow-hidden divide-y divide-[#2D3A2E]">
          {[
            { icon: Moon,     labelKey: "sleep.hub.title",       path: "/sleep",    testId: "link-sleep-profile"   },
            { icon: Shield,   labelKey: "profile.links.privacy", path: "/privacy",  testId: "link-privacy-profile" },
            { icon: FileText, labelKey: "profile.links.terms",   path: "/terms",    testId: "link-terms-profile"   },
            { icon: Phone,    labelKey: "profile.links.crisis",  path: "/crisis",   testId: "link-crisis-profile"  },
          ].map(({ icon: Icon, labelKey, path, testId }) => (
            <button key={path} onClick={() => setLocation(path)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-[#C8D5B9] hover:bg-[#1E241E] transition-colors text-left"
              data-testid={testId}
            >
              <Icon className="w-4 h-4 text-[#7A8A72] shrink-0" />{t(labelKey)}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-[#7A8A72] pt-2" data-testid="app-version">{t("profile.version")}</p>
      </main>

      <BottomNav />
      {movementSessionOpen && (
        <MovementSession
          onClose={() => setMovementSessionOpen(false)}
          onComplete={() => setMovementSessionOpen(false)}
        />
      )}
    </motion.div>
  );
}

function AchievementStat({ icon: Icon, label, value, color, testId }: {
  icon: LucideIcon; label: string; value: number; color: string; testId: string;
}) {
  const display = useCountUp(value);
  return (
    <div className="bg-[#222822] rounded-2xl border border-[#2D3A2E] p-5 flex flex-col items-center text-center gap-2" data-testid={testId}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}22` }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <p className="font-heading font-bold text-[#E8EDE3] tabular-nums" style={{ fontSize: 28, lineHeight: 1 }}>{display}</p>
      <p className="text-xs text-[#7A8A72] leading-snug">{label}</p>
    </div>
  );
}
