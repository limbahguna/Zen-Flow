import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  Brain, Flame, CheckCircle2, CalendarDays, HeartPulse,
  Wind, NotebookPen, GraduationCap, TrendingDown, TrendingUp, Minus,
  Clock, ArrowRight, ChevronRight, X, Moon, PersonStanding,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { DailyMotivation } from "@/components/DailyMotivation";
import { MovementSession } from "@/components/MovementSession";
import { WoopWizard } from "@/components/WoopWizard";
import { RatioCircle } from "@/components/RatioCircle";
import { WeeklyTrendChart } from "@/components/WeeklyTrendChart";
import { BreathingModal } from "@/components/BreathingModal";
import { LessonReader } from "@/components/LessonReader";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { OnboardingFlow, onboardingCompleted } from "@/components/OnboardingFlow";
import WeeklyReportCard from "@/components/WeeklyReportCard";
import { useTasks } from "@/hooks/useTasks";
import { useAnxietyChecks } from "@/hooks/useAnxietyChecks";
import { useLessons } from "@/hooks/useLessons";
import { useJournal } from "@/hooks/useJournal";
import { useIntentions, useIntentionActions } from "@/hooks/useIntentions";
import { IntentionForm } from "@/components/IntentionForm";
import { scheduleIntentionReminder } from "@/lib/intentionNotifications";
import type { IntentionInput } from "@/lib/intentions";
import { categoryMeta, type LessonRow } from "@/lib/lessons";
import {
  todayRatio, tasksCreatedToday, tasksCompletedToday,
  currentStreak, avgAnxietyToday, weeklyTrend, moodTrend, moodDirection,
} from "@/lib/insights";

// ── constants ──────────────────────────────────────────────────────────────

// Stable IDs for 30 daily quotes — UI copy from translation keys
const QUOTE_IDS = Array.from({ length: 30 }, (_, i) => i);

const NIGHT_STARS = [
  { top: 10, left: 7,  sz: 2, dur: 2.5 }, { top: 22, left: 18, sz: 1, dur: 3.2 },
  { top: 8,  left: 38, sz: 2, dur: 2.1 }, { top: 32, left: 55, sz: 1, dur: 3.8 },
  { top: 15, left: 70, sz: 2, dur: 2.7 }, { top: 40, left: 85, sz: 1, dur: 3.1 },
  { top: 6,  left: 50, sz: 1, dur: 2.9 }, { top: 28, left: 12, sz: 2, dur: 3.5 },
  { top: 45, left: 28, sz: 1, dur: 2.3 }, { top: 18, left: 90, sz: 2, dur: 3.7 },
  { top: 35, left: 72, sz: 1, dur: 2.6 }, { top: 50, left: 45, sz: 2, dur: 3.3 },
  { top: 12, left: 62, sz: 1, dur: 2.8 }, { top: 42, left: 8,  sz: 2, dur: 3.6 },
  { top: 25, left: 33, sz: 1, dur: 2.4 },
];

// Mood faces: stable internal labels, translated in UI
const MOOD_FACE_KEYS = [
  { emoji: "😞", key: "veryBad",  storageLabel: "Very bad" },
  { emoji: "😔", key: "bad",      storageLabel: "Bad" },
  { emoji: "😐", key: "okay",     storageLabel: "Okay" },
  { emoji: "🙂", key: "good",     storageLabel: "Good" },
  { emoji: "😄", key: "great",    storageLabel: "Great" },
];

// MOOD_HERO keyed by stable storage labels (not translated)
const MOOD_HERO: Record<string, string> = {
  "Very bad": "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80",
  "Bad":      "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80",
  "Good":     "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
  "Great":    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
};

// Mood greeting keys keyed by storage label
const MOOD_GREETING_KEY: Record<string, string> = {
  "Very bad": "dashboard.moodGreeting.bad",
  "Bad":      "dashboard.moodGreeting.bad",
  "Okay":     "dashboard.moodGreeting.okay",
  "Good":     "dashboard.moodGreeting.good",
  "Great":    "dashboard.moodGreeting.good",
};

// ── daily challenges (30-day rotating) — stable action IDs ────────────────

const DAILY_CHALLENGE_KEYS = [
  { titleKey: "dashboard.challenge.0.title",  descKey: "dashboard.challenge.0.desc",  ctaKey: "dashboard.challenge.0.cta",  action: "journal"     },
  { titleKey: "dashboard.challenge.1.title",  descKey: "dashboard.challenge.1.desc",  ctaKey: "dashboard.challenge.1.cta",  action: "breathe"     },
  { titleKey: "dashboard.challenge.2.title",  descKey: "dashboard.challenge.2.desc",  ctaKey: "dashboard.challenge.2.cta",  action: "mood"        },
  { titleKey: "dashboard.challenge.3.title",  descKey: "dashboard.challenge.3.desc",  ctaKey: "dashboard.challenge.3.cta",  action: "intention"   },
  { titleKey: "dashboard.challenge.4.title",  descKey: "dashboard.challenge.4.desc",  ctaKey: "dashboard.challenge.4.cta",  action: "journal"     },
  { titleKey: "dashboard.challenge.5.title",  descKey: "dashboard.challenge.5.desc",  ctaKey: "dashboard.challenge.5.cta",  action: "journal"     },
  { titleKey: "dashboard.challenge.6.title",  descKey: "dashboard.challenge.6.desc",  ctaKey: "dashboard.challenge.6.cta",  action: "breathe"     },
  { titleKey: "dashboard.challenge.7.title",  descKey: "dashboard.challenge.7.desc",  ctaKey: "dashboard.challenge.7.cta",  action: "intention"   },
  { titleKey: "dashboard.challenge.8.title",  descKey: "dashboard.challenge.8.desc",  ctaKey: "dashboard.challenge.8.cta",  action: "coach"       },
  { titleKey: "dashboard.challenge.9.title",  descKey: "dashboard.challenge.9.desc",  ctaKey: "dashboard.challenge.9.cta",  action: "intention"   },
  { titleKey: "dashboard.challenge.10.title", descKey: "dashboard.challenge.10.desc", ctaKey: "dashboard.challenge.10.cta", action: "mood"        },
  { titleKey: "dashboard.challenge.11.title", descKey: "dashboard.challenge.11.desc", ctaKey: "dashboard.challenge.11.cta", action: "breathe"     },
  { titleKey: "dashboard.challenge.12.title", descKey: "dashboard.challenge.12.desc", ctaKey: "dashboard.challenge.12.cta", action: "journal"     },
  { titleKey: "dashboard.challenge.13.title", descKey: "dashboard.challenge.13.desc", ctaKey: "dashboard.challenge.13.cta", action: "intention"   },
  { titleKey: "dashboard.challenge.14.title", descKey: "dashboard.challenge.14.desc", ctaKey: "dashboard.challenge.14.cta", action: "journal"     },
  { titleKey: "dashboard.challenge.15.title", descKey: "dashboard.challenge.15.desc", ctaKey: "dashboard.challenge.15.cta", action: "breathe"     },
  { titleKey: "dashboard.challenge.16.title", descKey: "dashboard.challenge.16.desc", ctaKey: "dashboard.challenge.16.cta", action: "intention"   },
  { titleKey: "dashboard.challenge.17.title", descKey: "dashboard.challenge.17.desc", ctaKey: "dashboard.challenge.17.cta", action: "breathe"     },
  { titleKey: "dashboard.challenge.18.title", descKey: "dashboard.challenge.18.desc", ctaKey: "dashboard.challenge.18.cta", action: "journal"     },
  { titleKey: "dashboard.challenge.19.title", descKey: "dashboard.challenge.19.desc", ctaKey: "dashboard.challenge.19.cta", action: "coach"       },
  { titleKey: "dashboard.challenge.20.title", descKey: "dashboard.challenge.20.desc", ctaKey: "dashboard.challenge.20.cta", action: "intentions"  },
  { titleKey: "dashboard.challenge.21.title", descKey: "dashboard.challenge.21.desc", ctaKey: "dashboard.challenge.21.cta", action: "breathe"     },
  { titleKey: "dashboard.challenge.22.title", descKey: "dashboard.challenge.22.desc", ctaKey: "dashboard.challenge.22.cta", action: "intention"   },
  { titleKey: "dashboard.challenge.23.title", descKey: "dashboard.challenge.23.desc", ctaKey: "dashboard.challenge.23.cta", action: "journal"     },
  { titleKey: "dashboard.challenge.24.title", descKey: "dashboard.challenge.24.desc", ctaKey: "dashboard.challenge.24.cta", action: "mood"        },
  { titleKey: "dashboard.challenge.25.title", descKey: "dashboard.challenge.25.desc", ctaKey: "dashboard.challenge.25.cta", action: "breathe"     },
  { titleKey: "dashboard.challenge.26.title", descKey: "dashboard.challenge.26.desc", ctaKey: "dashboard.challenge.26.cta", action: "journal"     },
  { titleKey: "dashboard.challenge.27.title", descKey: "dashboard.challenge.27.desc", ctaKey: "dashboard.challenge.27.cta", action: "intention"   },
  { titleKey: "dashboard.challenge.28.title", descKey: "dashboard.challenge.28.desc", ctaKey: "dashboard.challenge.28.cta", action: "journal"     },
  { titleKey: "dashboard.challenge.29.title", descKey: "dashboard.challenge.29.desc", ctaKey: "dashboard.challenge.29.cta", action: "intention"   },
] as const;

// ── helpers ────────────────────────────────────────────────────────────────

function todayKey() { return new Date().toISOString().slice(0, 10); }

function isToday(iso: string): boolean {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function greetingText(tFn: (key: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return tFn("dashboard.greeting.morning");
  if (h < 18) return tFn("dashboard.greeting.afternoon");
  return tFn("dashboard.greeting.evening");
}
function greetingEmoji(): string {
  const h = new Date().getHours();
  if (h < 12) return "🌅";
  if (h < 18) return "☀️";
  return "🌙";
}

function getTimeSlot(): "morning" | "afternoon" | "evening" | "night" {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18 && h < 23) return "evening";
  return "night";
}

const HERO_IMAGES = {
  morning:   "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800&q=80",
  afternoon: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
  evening:   "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80",
  night:     "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
} as const;

function getDailyQuoteIndex() {
  return Math.floor(Date.now() / 86400000) % 30;
}

function moodCardDismissKey(uid: string) { return `mood_card_dismissed_${uid}_${todayKey()}`; }

// ── page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, displayName } = useProfile();
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useTasks();
  const { data: checks } = useAnxietyChecks();
  const {
    data: lessons,
    isLoading: lessonsLoading,
    isFetching: lessonsFetching,
    isSuccess: lessonsSuccess,
  } = useLessons();
  const { data: journalEntries } = useJournal();
  const { data: intentions = [] } = useIntentions();
  const intentionActions = useIntentionActions();

  // modals
  const [wizardOpen,    setWizardOpen]    = useState(false);
  const [breathingOpen, setBreathingOpen] = useState(false);
  const [showOnboarding,setShowOnboarding]= useState(false);
  const [intentionOpen, setIntentionOpen] = useState(false);
  const [intentionConfirmOpen, setIntentionConfirmOpen] = useState(false);
  const [moodPickerOpen,setMoodPickerOpen]= useState(false);
  const [intentionAdviceOpen, setIntentionAdviceOpen] = useState(false);
  const [intentionAdviceKey, setIntentionAdviceKey]   = useState("dashboard.intentionAdvice.default");
  const [activLesson,   setActivLesson]   = useState<LessonRow | null>(null);
  const [movementSessionOpen, setMovementSessionOpen] = useState(false);

  // Reconcile an open lesson against the locale-specific catalog.
  // Once the lesson query for the current language has settled (not loading/
  // fetching), match the open lesson by stable ID: replace it with the
  // current-language version if present, or close the reader if the ID is
  // absent (e.g. a remote English-only lesson after switching to ID/JA).
  // Guarded so we never reconcile/close prematurely while the query is in
  // flight, which would otherwise flash stale English content.
  useEffect(() => {
    if (!activLesson) return;
    if (lessonsLoading || lessonsFetching || !lessonsSuccess) return;
    const current = lessons?.find((l) => l.id === activLesson.id);
    if (!current) {
      setActivLesson(null);
    } else if (
      current.title !== activLesson.title ||
      current.content !== activLesson.content ||
      current.category !== activLesson.category ||
      current.reading_time_minutes !== activLesson.reading_time_minutes ||
      current.sort_order !== activLesson.sort_order ||
      current.active !== activLesson.active ||
      current.created_at !== activLesson.created_at
    ) {
      setActivLesson(current);
    }
    // `language` drives re-run after a locale switch once the catalog settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons, lessonsLoading, lessonsFetching, lessonsSuccess, language, activLesson?.id]);

  // mood-card dismiss
  const [moodCardDismissed, setMoodCardDismissed] = useState(() => {
    try { return !!localStorage.getItem(moodCardDismissKey(user?.id ?? "")); } catch { return false; }
  });
  function dismissMoodCard() {
    try { localStorage.setItem(moodCardDismissKey(user?.id ?? ""), "1"); } catch {}
    setMoodCardDismissed(true);
  }
  const [badMoodModalOpen, setBadMoodModalOpen] = useState(false);
  const [eveningDismissed, setEveningDismissed] = useState(() => {
    try { return !!localStorage.getItem(`evening_dismissed_${user?.id ?? ""}_${todayKey()}`); } catch { return false; }
  });
  function dismissEveningCard() {
    try { localStorage.setItem(`evening_dismissed_${user?.id ?? ""}_${todayKey()}`, "1"); } catch {}
    setEveningDismissed(true);
  }
  const [windDownDismissed, setWindDownDismissed] = useState(() => {
    try { return !!localStorage.getItem("winddown_dismissed_" + new Date().toDateString()); } catch { return false; }
  });
  function dismissWindDown() {
    try { localStorage.setItem("winddown_dismissed_" + new Date().toDateString(), "true"); } catch {}
    setWindDownDismissed(true);
  }

  // daily mood pill — stored with stable EN labels, displayed translated
  const [dailyMood, setDailyMood] = useState<string | null>(() => {
    try { return localStorage.getItem(`daily_mood_${user?.id ?? ""}_${todayKey()}`); } catch { return null; }
  });
  function saveDailyMood(storageLabel: string) {
    try { localStorage.setItem(`daily_mood_${user?.id ?? ""}_${todayKey()}`, storageLabel); } catch {}
    setDailyMood(storageLabel); setMoodPickerOpen(false);
    const idx = MOOD_FACE_KEYS.findIndex(f => f.storageLabel === storageLabel);
    if (idx <= 1) {
      setBadMoodModalOpen(true);
    } else if (idx === 2) {
      toast({ title: t("dashboard.toast.neutral.title"), description: t("dashboard.toast.neutral.desc"), duration: 4000 });
    } else {
      toast({ title: t("dashboard.toast.good.title"), description: t("dashboard.toast.good.desc"), duration: 4000 });
    }
  }

  const [intentionInput, setIntentionInput] = useState("");

  function getIntentionAdviceKey(text: string): string {
    const lower = text.toLowerCase();
    if (/exercise|gym|run|workout|health|walk|fitness/.test(lower))
      return "dashboard.intentionAdvice.exercise";
    if (/work|project|deadline|report|email|meeting|client/.test(lower))
      return "dashboard.intentionAdvice.work";
    if (/study|learn|read|course|book|practice/.test(lower))
      return "dashboard.intentionAdvice.study";
    if (/clean|organiz|home|tidy|declutter/.test(lower))
      return "dashboard.intentionAdvice.clean";
    return "dashboard.intentionAdvice.default";
  }

  function continueIntention() {
    if (!intentionInput.trim()) return;
    setIntentionOpen(false);
    setIntentionConfirmOpen(true);
  }

  async function saveIntention(input: IntentionInput) {
    let created = await intentionActions.create.mutateAsync(input);
    if (input.reminder_choice !== "off") {
      let scheduled = false;
      try { scheduled = await scheduleIntentionReminder(created); } catch { scheduled = false; }
      if (!scheduled) {
        created = await intentionActions.update.mutateAsync({
          id: created.id,
          input: { ...input, reminder_choice: "off", reminder_time: null },
        });
        toast({
          title: language === "id" ? "Pengingat tidak diaktifkan" : language === "ja" ? "リマインダーはオフです" : "Reminder not enabled",
          description: language === "id" ? "Niat tersimpan tanpa pengingat. Izin notifikasi dapat diaktifkan nanti." : language === "ja" ? "インテンションはリマインダーなしで保存されました。" : "Your intention was saved without a reminder. You can enable notification permission later.",
        });
      }
    }
    setIntentionConfirmOpen(false);
    setIntentionInput("");
    setIntentionAdviceKey(getIntentionAdviceKey(input.title));
    setIntentionAdviceOpen(true);
  }

  function handleDisclaimerDismissed() {
    if (user && !onboardingCompleted(user.id)) setShowOnboarding(true);
  }

  const allTasks  = useMemo(() => tasks  ?? [], [tasks]);
  const allChecks = useMemo(() => checks ?? [], [checks]);

  const ratio          = useMemo(() => todayRatio(allTasks),         [allTasks]);
  const createdToday   = useMemo(() => tasksCreatedToday(allTasks),  [allTasks]);
  const completedToday = useMemo(() => tasksCompletedToday(allTasks),[allTasks]);
  const streak         = useMemo(() => currentStreak(allTasks),      [allTasks]);
  const avgAnxiety     = useMemo(() => avgAnxietyToday(allChecks),   [allChecks]);
  const weekBars       = useMemo(() => weeklyTrend(allTasks),        [allTasks]);
  const moodPoints     = useMemo(() => moodTrend(allChecks),         [allChecks]);
  const direction      = useMemo(() => moodDirection(moodPoints),    [moodPoints]);
  const todaysTasks    = useMemo(() => allTasks.filter(tk => isToday(tk.created_at)), [allTasks]);
  const hasData        = allTasks.length > 0;
  const daysWithTasks  = useMemo(() => new Set(allTasks.map(tk => tk.created_at.slice(0,10))).size, [allTasks]);
  const showWeeklyTrend = hasData && daysWithTasks >= 2;

  const pendingIntentions = useMemo(() => allTasks.filter(tk => tk.status === "pending").length, [allTasks]);
  const weeklyCompleted = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7); cutoff.setHours(0, 0, 0, 0);
    return allTasks.filter(tk => (tk.status === "done" || tk.status === "completed") && new Date(tk.completed_at ?? tk.created_at) >= cutoff).length;
  }, [allTasks]);
  const weeklyTotal = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7); cutoff.setHours(0, 0, 0, 0);
    return allTasks.filter(tk => new Date(tk.created_at) >= cutoff).length;
  }, [allTasks]);
  const isEvening = new Date().getHours() >= 18;
  const isAfter7PM = new Date().getHours() >= 19;
  const bedtimeHour = (() => { try { return parseFloat(localStorage.getItem("mindful_bedtime") ?? "0"); } catch { return 0; } })();
  const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
  const showWindDown = bedtimeHour > 0 && currentHour >= bedtimeHour && currentHour < bedtimeHour + 2 && !windDownDismissed;
  const actionRate = weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0;

  const completedTasksCount = useMemo(() => allTasks.filter(tk => tk.status === "done" || tk.status === "completed").length, [allTasks]);
  const allTimeCompletionRate = allTasks.length > 0 ? Math.round((completedTasksCount / allTasks.length) * 100) : 0;
  const breathingSessionsCount = useMemo(() => allChecks.filter(c => c.breathing_completed).length, [allChecks]);
  const moodTimeline = useMemo(() => allChecks.length >= 2 ? [...allChecks].slice(0, 7).reverse() : [], [allChecks]);
  const journalCount = journalEntries?.length ?? 0;
  const avgMoodShiftNum = useMemo(() => {
    if (!journalEntries || journalEntries.length === 0) return 0;
    const valid = journalEntries.filter(e => e.mood_before != null && e.mood_after != null);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, e) => acc + ((e.mood_after ?? 0) - (e.mood_before ?? 0)), 0);
    return Math.round((sum / valid.length) * 10) / 10;
  }, [journalEntries]);
  const totalActivities = allTasks.length + journalCount + allChecks.length;

  // Coach insight lines — use translation keys with numeric interpolation
  const coachInsightKeys = [
    "dashboard.coachInsight.0",
    "dashboard.coachInsight.1",
    "dashboard.coachInsight.2",
    "dashboard.coachInsight.3",
    "dashboard.coachInsight.4",
  ] as const;
  const coachInsightKey = coachInsightKeys[Math.floor(Date.now() / 86400000) % coachInsightKeys.length];
  const coachInsight = (() => {
    const raw = t(coachInsightKey);
    // Replace numeric placeholders that depend on runtime data
    return raw
      .replace("{completedTasksCount}", String(completedTasksCount))
      .replace("{avgMoodShift}", (avgMoodShiftNum >= 0 ? "+" : "") + String(avgMoodShiftNum))
      .replace("{breathingSessions}", String(breathingSessionsCount))
      .replace("{breathingSeconds}", String(breathingSessionsCount * 57))
      .replace("{completionRate}", String(allTimeCompletionRate))
      .replace("{completionRateMsg}", allTimeCompletionRate > 50 ? t("dashboard.coachInsight.impressive") : t("dashboard.coachInsight.keepGoing"))
      .replace("{journalCount}", String(journalCount))
      .replace("{journalWord}", journalCount === 1 ? t("dashboard.coachInsight.entry") : t("dashboard.coachInsight.entries"));
  })();

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks", user?.id ?? ""] });
    setWizardOpen(false);
  };

  const quoteIndex  = getDailyQuoteIndex();
  const timeSlot    = getTimeSlot();
  const firstName   = displayName || (user?.email?.split("@")[0] ?? t("dashboard.fallbackName"));

  // profile-based adaptive content
  const initialMood  = profile?.initial_mood ? parseInt(profile.initial_mood, 10) : null;
  const primaryGoal  = profile?.primary_goal ?? "";
  const showMoodCard = !moodCardDismissed && initialMood !== null && !isNaN(initialMood);

  // today's lesson (rotate by day of year)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const todaysLesson = lessons && lessons.length > 0 ? lessons[dayOfYear % lessons.length] : null;

  // Translated mood label for current daily mood
  const moodFace = MOOD_FACE_KEYS.find(m => m.storageLabel === dailyMood);
  const moodLabel = moodFace ? t(`dashboard.mood.${moodFace.key}`) : "";
  const activeIntention = intentions.find((item) => item.status === "active");

  return (
    <motion.div
      className="min-h-screen bg-[#1A1E1A] pb-24"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
    >
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div
        data-testid="dashboard-hero"
        className="relative w-full overflow-hidden"
        style={{
          height: 280,
          backgroundImage: `url('${MOOD_HERO[dailyMood ?? ""] ?? HERO_IMAGES[timeSlot]}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: "0 0 24px 24px",
        }}
      >
        {/* Dark gradient overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(26,30,26,0.88) 100%)" }}
        />

        {/* Decorative: night stars */}
        {timeSlot === "night" && NIGHT_STARS.map((s, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.sz, height: s.sz, zIndex: 1 }}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: s.dur, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
        {/* Decorative: morning sun glow */}
        {timeSlot === "morning" && (
          <motion.div
            className="absolute"
            style={{
              top: 16, right: 24, width: 48, height: 48, borderRadius: "50%", zIndex: 1,
              background: "radial-gradient(circle, rgba(212,185,106,0.5) 0%, transparent 70%)",
            }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        {/* Decorative: evening glow */}
        {timeSlot === "evening" && (
          <div
            className="absolute"
            style={{
              top: 12, right: 20, width: 40, height: 40, zIndex: 1,
              background: "radial-gradient(circle, rgba(176,138,212,0.4) 0%, transparent 70%)",
              borderRadius: "50%",
            }}
          />
        )}

        {/* Fireflies */}
        {[
          { t: 30, l: 20, dl: 0.0 },
          { t: 50, l: 60, dl: 0.8 },
          { t: 20, l: 80, dl: 1.6 },
          { t: 65, l: 35, dl: 0.4 },
          { t: 40, l: 45, dl: 1.2 },
        ].map((f, i) => (
          <motion.div
            key={`ff-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{ top: `${f.t}%`, left: `${f.l}%`, width: 3, height: 3, background: "rgba(200,213,185,0.8)", zIndex: 1 }}
            animate={{ y: [-4, 4, -4], x: [-3, 3, -3], opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 4 + i * 0.7, repeat: Infinity, ease: "easeInOut", delay: f.dl }}
          />
        ))}

        {/* Greeting overlaid at bottom-left */}
        <div className="absolute bottom-5 left-5 right-5" style={{ zIndex: 2 }}>
          <p className="text-sm text-white/70" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
            {greetingEmoji()} {greetingText(t)},
          </p>
          <h1
            className="font-heading font-bold text-3xl text-white capitalize mt-0.5"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
          >
            {firstName}
          </h1>
          {dailyMood && MOOD_GREETING_KEY[dailyMood] ? (
            <motion.p
              key={dailyMood}
              className="text-xs text-white/70 mt-1 leading-relaxed"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {t(MOOD_GREETING_KEY[dailyMood])}
            </motion.p>
          ) : (
            <p
              className="text-xs text-white/50 italic mt-1 leading-relaxed"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
            >
              "
              {t(`dashboard.quote.${quoteIndex}`).split(" ").map((word, wi) => (
                <motion.span
                  key={wi}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 + wi * 0.09, duration: 0.3 }}
                >
                  {word}{" "}
                </motion.span>
              ))}
              "
            </p>
          )}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 pt-5 space-y-5">
        {activeIntention && (
          <button
            type="button"
            data-testid="todays-focus"
            onClick={() => setLocation(`/practice?tab=intentions&intention=${activeIntention.id}`)}
            className="w-full rounded-2xl border border-[#3D4D35] bg-[#222822] p-4 text-left"
          >
            <p className="mb-1 text-[11px] uppercase tracking-[0.16em] text-[#8FA680]">
              {language === "id" ? "Fokus hari ini" : language === "ja" ? "今日のフォーカス" : "Today's focus"}
            </p>
            <h2 className="font-heading text-lg font-semibold text-[#E8EDE3]">{activeIntention.title}</h2>
            <p className="mt-1 text-sm text-[#A3B197]">{activeIntention.small_action}</p>
          </button>
        )}

        {/* ── Sleep Wind-Down Card ────────────────────────────────────── */}
        {showWindDown && (
          <div
            data-testid="winddown-card"
            style={{
              background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)",
              borderRadius: 20, padding: 20,
              position: "relative", overflow: "hidden",
            }}
          >
            {/* Deterministic stars */}
            {([
              { t: 15, l: 12, o: 0.40 }, { t: 8,  l: 35, o: 0.30 },
              { t: 22, l: 58, o: 0.50 }, { t: 12, l: 75, o: 0.35 },
              { t: 28, l: 25, o: 0.25 }, { t: 5,  l: 48, o: 0.45 },
              { t: 18, l: 88, o: 0.30 }, { t: 32, l: 65, o: 0.40 },
            ] as { t: number; l: number; o: number }[]).map((s, i) => (
              <div key={i} style={{
                position: "absolute", width: 2, height: 2, background: "white",
                borderRadius: "50%", top: `${s.t}%`, left: `${s.l}%`, opacity: s.o,
                pointerEvents: "none",
              }} />
            ))}
            <button
              onClick={dismissWindDown}
              style={{
                position: "absolute", top: 10, right: 10,
                background: "none", border: "none",
                color: "rgba(255,255,255,0.35)", fontSize: 18,
                cursor: "pointer", lineHeight: 1, padding: 4,
              }}
              aria-label={t("common.close")}
            >✕</button>
            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌙</div>
              <h3 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 20, color: "#E8EDE3", marginBottom: 6,
              }}>
                {t("dashboard.winddown.title")}
              </h3>
              <p style={{ fontSize: 13, color: "rgba(200,213,185,0.7)", lineHeight: 1.5, marginBottom: 14 }}>
                {t("dashboard.winddown.body")}
              </p>
              <button
                onClick={() => setLocation("/sleep")}
                style={{
                  background: "rgba(143,166,128,0.25)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(143,166,128,0.35)",
                  color: "#E8EDE3", borderRadius: 12,
                  padding: "11px 24px", fontSize: 15,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {t("dashboard.winddown.cta")}
              </button>
            </div>
          </div>
        )}

        {/* ── Evening Reflection ─────────────────────────────────────── */}
        {isEvening && pendingIntentions > 0 && !eveningDismissed && (
          <div
            data-testid="evening-reflection-card"
            style={{
              background: "linear-gradient(135deg, #2D2420 0%, #1E1A18 100%)",
              borderRadius: 16, padding: 16,
              border: "0.5px solid #4D3020",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <p style={{ fontSize: 11, color: "#D4A06A", letterSpacing: 1, textTransform: "uppercase" }}>
                {t("dashboard.evening.eyebrow")}
              </p>
              <button
                onClick={dismissEveningCard}
                aria-label={t("dashboard.evening.dismiss")}
                style={{ color: "#7A6A60", background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 0 0 8px" }}
              >×</button>
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, color: "#E8EDE3", marginBottom: 6 }}>
              {t("dashboard.evening.title")}
            </p>
            <p style={{ fontSize: 13, color: "#A3B197", marginBottom: 12 }}>
              {t("dashboard.evening.body").replace("{n}", String(pendingIntentions))}
            </p>
            <button
              onClick={() => setLocation("/practice")}
              type="button"
              style={{
                background: "#4A3520", color: "#D4A06A", border: "1px solid #4D3020",
                borderRadius: 10, padding: "8px 16px", fontSize: 13, cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {t("dashboard.evening.cta")}
            </button>
          </div>
        )}

        {/* ── Daily Card ─────────────────────────────────────────────── */}
        {(() => {
          const challenge = DAILY_CHALLENGE_KEYS[Math.floor(Date.now() / 86400000) % 30];
          const handleCTA = () => {
            switch (challenge.action) {
              case "breathe":     setBreathingOpen(true); break;
              case "journal":     localStorage.setItem("practice_tab","journal"); localStorage.setItem("journal_open_new","1"); setLocation("/practice"); break;
              case "mood":        setMoodPickerOpen(true); break;
              case "intention":   setIntentionOpen(true); break;
              case "coach":       setLocation("/coach"); break;
              case "intentions":  setLocation("/practice"); break;
            }
          };
          return (
            <div
              data-testid="daily-card"
              style={{
                background: "linear-gradient(135deg, #222822 0%, #2D3A2E 100%)",
                borderRadius: 16, padding: 20,
                border: "0.5px solid #3D4D35",
              }}
            >
              <p style={{ fontSize: 11, color: "#7A8A72", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                {t("dashboard.dailyCard.eyebrow").replace("{day}", String(dayOfYear % 30 + 1))}
              </p>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: "#E8EDE3", marginBottom: 6, fontFamily: "'Playfair Display', serif" }}>
                {t(challenge.titleKey)}
              </h3>
              <p style={{ fontSize: 13, color: "#A3B197", lineHeight: 1.5, marginBottom: 12 }}>
                {t(challenge.descKey)}
              </p>
              <button
                onClick={handleCTA}
                type="button"
                style={{
                  background: "#4A5D3E", color: "#E8EDE3", border: "none",
                  borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {t(challenge.ctaKey)}
              </button>
            </div>
          );
        })()}

        {/* ── Today's Lesson ─────────────────────────────────────────── */}
        {todaysLesson && (() => {
          const meta = categoryMeta(todaysLesson.category);
          const LessonIcon = meta.icon;
          return (
            <button
              type="button"
              data-testid="todays-lesson-card"
              onClick={() => setActivLesson(todaysLesson)}
              className="w-full text-left flex items-center gap-3.5 rounded-2xl border border-[#2D3A2E] p-4 hover:border-[#3D4D35] transition-colors duration-200"
              style={{ background: "linear-gradient(135deg, #222822 0%, #1E241E 100%)" }}
            >
              <div
                className="shrink-0 flex items-center justify-center rounded-xl"
                style={{ width: 44, height: 44, backgroundColor: meta.iconBg }}
              >
                <LessonIcon className="w-5 h-5" style={{ color: meta.iconColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 11, color: "#7A8A72", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  {t("dashboard.quickActions.lessons")}
                </p>
                <h3 className="font-bold text-[#E8EDE3] leading-snug" style={{ fontSize: "14px" }}>
                  {todaysLesson.title}
                </h3>
              </div>
              <ChevronRight className="w-4 h-4 text-[#7A8A72] shrink-0" />
            </button>
          );
        })()}

        {/* ── Daily Motivation ───────────────────────────────────────── */}
        <DailyMotivation />

        {/* ── Weekly Report ──────────────────────────────────────────── */}
        <WeeklyReportCard />

        {/* ── Inline mood pill ───────────────────────────────────────── */}
        <button
          onClick={() => setMoodPickerOpen(true)}
          data-testid="mood-pill"
          className="w-full flex items-center gap-3 rounded-full px-4 py-3 border transition-colors duration-200 hover:border-[#3D4D35]"
          style={{ backgroundColor: "#222822", borderColor: "#2D3A2E", borderWidth: "0.5px" }}
        >
          <motion.span
            className="text-xl"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {dailyMood ? MOOD_FACE_KEYS.find(m => m.storageLabel === dailyMood)?.emoji ?? "😐" : "😊"}
          </motion.span>
          <span className="flex-1 text-sm text-left text-[#A3B197]">
            {dailyMood
              ? t("dashboard.moodPill.update").replace("{mood}", moodLabel)
              : t("dashboard.moodPill.prompt")}
          </span>
          <ChevronRight className="w-4 h-4 text-[#7A8A72]" />
        </button>

        {/* ── Mood mini-timeline ──────────────────────────────────────── */}
        {moodTimeline.length >= 2 && (
          <div
            data-testid="mood-mini-timeline"
            style={{
              display: "flex", alignItems: "flex-end", gap: 4,
              height: 36, padding: "4px 14px",
              background: "#1A1E1A", borderRadius: 10,
              border: "0.5px solid #222822",
            }}
          >
            {moodTimeline.map((check, i) => {
              const intensity = check.intensity ?? 5;
              const barColor = intensity <= 3 ? "#D4806A" : intensity <= 5 ? "#D4B96A" : "#8FA680";
              const barH = Math.max(4, Math.min(28, intensity * 3));
              return (
                <div
                  key={check.id}
                  title={`${t("dashboard.moodTimeline.intensity")}: ${intensity}`}
                  style={{
                    flex: 1, height: barH, borderRadius: 3, background: barColor,
                    opacity: 0.4 + (i / moodTimeline.length) * 0.6,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* ── Streak card ────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", background: "#222822",
            borderRadius: 12, border: "0.5px solid #2D3A2E",
          }}
          data-testid="streak-card"
        >
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
              {streak >= 30 ? `🌳 ${t("dashboard.streak.tree")}` : streak >= 14 ? `🌿 ${t("dashboard.streak.sprout")}` : `🌱 ${t("dashboard.streak.seedling")}`}
            </div>
          )}
        </div>

        {/* ── All-time action rate ────────────────────────────────────── */}
        {completedTasksCount >= 3 && allTasks.length > 0 && (
          <div
            data-testid="action-rate-insight"
            style={{ background: "#222822", borderRadius: 12, padding: "10px 16px", border: "0.5px solid #2D3A2E" }}
          >
            <p style={{ fontSize: 13, color: "#A3B197", lineHeight: 1.5, margin: 0 }}>
              {t("dashboard.actionRate.text")
                .replace("{completed}", String(completedTasksCount))
                .replace("{total}", String(allTasks.length))
                .replace("{rate}", String(allTimeCompletionRate))}{" "}
              <span style={{ color: allTimeCompletionRate >= 60 ? "#7AC47A" : allTimeCompletionRate >= 30 ? "#D4B96A" : "#7A8A72" }}>
                {allTimeCompletionRate >= 60
                  ? t("dashboard.actionRate.high")
                  : allTimeCompletionRate >= 30
                    ? t("dashboard.actionRate.mid")
                    : t("dashboard.actionRate.low")}
              </span>
            </p>
          </div>
        )}

        {/* ── Mood-adaptive card ─────────────────────────────────────── */}
        <AnimatePresence>
          {showMoodCard && (
            <motion.div
              key="mood-card"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
            >
              <MoodAdaptiveCard
                mood={initialMood!}
                onBreathing={() => setBreathingOpen(true)}
                onWoop={() => setWizardOpen(true)}
                onDismiss={dismissMoodCard}
                t={t}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Quick actions ──────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7A8A72]">
            {t("dashboard.quickActions.title")}
          </h2>
          {([
            { icon: Clock,         iconColor: "#D4B96A", iconBg: "#2D2410", title: t("dashboard.quickActions.focus"),    sub: t("dashboard.quickActions.focusSub"),    action: () => setLocation("/focus"),          testId: "quick-focus"    },
            ...(isAfter7PM ? [{ icon: Moon, iconColor: "#B08AD4", iconBg: "#2D2040", title: t("dashboard.quickActions.sleep"), sub: t("dashboard.quickActions.sleepSub"), action: () => setLocation("/sleep"), testId: "quick-sleep" }] : []),
            { icon: Wind,          iconColor: "#5BB8B8", iconBg: "#0F2D2D", title: t("dashboard.quickActions.breathe"),  sub: t("dashboard.quickActions.breatheSub"),  action: () => setBreathingOpen(true),         testId: "quick-breathe"  },
            { icon: NotebookPen,   iconColor: "#B08AD4", iconBg: "#221A2D", title: t("dashboard.quickActions.journal"),  sub: t("dashboard.quickActions.journalSub"),  action: () => { localStorage.setItem("practice_tab","journal"); localStorage.setItem("journal_open_new","1"); setLocation("/practice"); },  testId: "quick-journal"  },
            { icon: GraduationCap, iconColor: "#D4B96A", iconBg: "#2D2410", title: t("dashboard.quickActions.lessons"),  sub: t("dashboard.quickActions.lessonsSub"),  action: () => { localStorage.setItem("practice_tab","lessons"); setLocation("/practice"); },  testId: "quick-learn"    },
            { icon: PersonStanding, iconColor: "#8FA680", iconBg: "#1E2D1E", title: t("movement.quick.title"), sub: t("movement.quick.sub"), action: () => setMovementSessionOpen(true), testId: "quick-move" },
          ] as { icon: typeof Clock; iconColor: string; iconBg: string; title: string; sub: string; action: () => void; testId: string }[]).map((q, i) => (
            <motion.button
              key={q.testId}
              onClick={q.action}
              data-testid={q.testId}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[#2D3A2E] bg-[#222822] text-left hover:border-[#3D4D35] hover:bg-[#1E241E] transition-colors duration-200"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.985 }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: q.iconBg }}>
                <q.icon className="w-5 h-5" style={{ color: q.iconColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#E8EDE3]">{q.title}</p>
                <p className="text-xs text-[#7A8A72] mt-0.5">{q.sub}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#7A8A72] shrink-0" />
            </motion.button>
          ))}
        </section>

        {/* ── Coach insight card ─────────────────────────────────────── */}
        {totalActivities >= 5 && (
          <div
            data-testid="coach-insight-card"
            style={{
              background: "#222822", border: "0.5px solid #2D3A2E",
              borderRadius: 12, padding: "12px 14px",
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "#2D3A2E",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Brain className="w-4 h-4" style={{ color: "#8FA680" }} />
            </div>
            <p style={{ fontSize: 13, color: "#A3B197", lineHeight: 1.5, margin: 0 }}>
              {coachInsight}
            </p>
          </div>
        )}

        {/* ── Stats (only with data) ─────────────────────────────────── */}
        {hasData && (
          <>
            <section className="bg-[#222822] rounded-2xl border border-[#2D3A2E] p-6 flex flex-col items-center">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7A8A72] mb-4">
                {t("dashboard.stats.ratio")}
              </h2>
              <RatioCircle ratio={ratio.ratio} planned={ratio.planned} done={ratio.done} />
            </section>
            <section className="grid grid-cols-2 gap-3">
              <StatCard icon={CalendarDays} label={t("dashboard.stats.tasksToday")}    value={String(createdToday)}                       color="#8FA680" testId="stat-tasks-today" />
              <StatCard icon={CheckCircle2} label={t("dashboard.stats.completed")}      value={String(completedToday)}                     color="#7AC47A" testId="stat-completed" />
              <StatCard icon={Flame}        label={t("dashboard.stats.streak")}         value={streak === 1 ? t("dashboard.stats.oneDay") : t("dashboard.stats.nDays").replace("{n}", String(streak))} color="#D4B96A" testId="stat-streak" />
              {avgAnxiety !== null && (
                <StatCard icon={HeartPulse} label={t("dashboard.stats.avgAnxiety")}    value={`${avgAnxiety}/10`}                         color="#D4806A" testId="stat-avg-anxiety" />
              )}
            </section>
          </>
        )}

        {/* ── Weekly trend ───────────────────────────────────────────── */}
        {showWeeklyTrend && (
          <>
            <section className="bg-[#222822] rounded-2xl border border-[#2D3A2E] p-6">
              <h2 className="font-heading font-bold text-[#E8EDE3] mb-1">{t("dashboard.weeklyTrend.title")}</h2>
              <p className="text-xs text-[#7A8A72] mb-4">{t("dashboard.weeklyTrend.subtitle")}</p>
              <WeeklyTrendChart bars={weekBars} />
            </section>
            <section className="bg-[#222822] rounded-2xl border border-[#2D3A2E] p-6">
              <h2 className="font-heading font-bold text-[#E8EDE3] mb-1">{t("dashboard.moodTrend.title")}</h2>
              <p className="text-xs text-[#7A8A72] mb-4">{t("dashboard.moodTrend.subtitle")}</p>
              <MoodTrendSection points={moodPoints} direction={direction} t={t} />
            </section>
          </>
        )}

        {/* ── Sleep Support Link ──────────────────────────────────────── */}
        <button
          onClick={() => setLocation("/sleep")}
          className="w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-transform active:scale-[0.98] mt-3"
          style={{
            background: "linear-gradient(135deg, #11151F 0%, #0D1018 100%)",
            borderColor: "#1C263A",
          }}
          data-testid="link-sleep-dashboard"
        >
          <div className="w-12 h-12 rounded-xl bg-[#1C263A] text-[#8FA6C8] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(143,166,200,0.15)]">
            <Moon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-[#E8EDE3] text-base">{t("sleep.hub.title")}</h3>
            <p className="text-xs text-[#7A8A9E] mt-0.5 truncate">{t("sleep.hub.subtitle")}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#4D5B70] shrink-0" />
        </button>
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {/* Morning Intention modal */}
      <AnimatePresence>
        {intentionOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
          >
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="w-full max-w-md bg-[#222822] border border-[#2D3A2E] rounded-2xl p-6 space-y-4"
              data-testid="intention-modal"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading font-bold text-lg text-[#E8EDE3]">{t("dashboard.intentionModal.title")}</p>
                  <p className="text-sm text-[#7A8A72] mt-0.5">{t("dashboard.intentionModal.subtitle")}</p>
                </div>
                <button onClick={() => setIntentionOpen(false)} className="text-[#7A8A72] hover:text-[#A3B197]" aria-label={t("common.close")}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <textarea
                value={intentionInput}
                onChange={e => setIntentionInput(e.target.value)}
                placeholder={t("dashboard.intentionModal.placeholder")}
                rows={3}
                className="w-full rounded-xl border border-[#2D3A2E] bg-[#1A1E1A] px-4 py-3 text-sm text-[#C8D5B9] placeholder:text-[#7A8A72] focus:outline-none focus:border-[#8FA680] resize-none transition-colors"
                data-testid="intention-input"
                autoFocus
              />
              <button
                onClick={continueIntention}
                disabled={!intentionInput.trim()}
                className="w-full h-11 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors disabled:opacity-50"
                data-testid="button-save-intention"
              >
                {t("dashboard.intentionModal.save")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {intentionConfirmOpen && (
          <IntentionForm
            seedTitle={intentionInput}
            onClose={() => setIntentionConfirmOpen(false)}
            onSave={saveIntention}
            saving={intentionActions.create.isPending}
          />
        )}
      </AnimatePresence>

      {/* Daily mood picker modal */}
      <AnimatePresence>
        {moodPickerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
            onClick={() => setMoodPickerOpen(false)}
          >
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="w-full max-w-md bg-[#222822] border border-[#2D3A2E] rounded-2xl p-6 space-y-5"
              onClick={e => e.stopPropagation()}
              data-testid="mood-picker-modal"
            >
              <p className="font-heading font-bold text-lg text-[#E8EDE3] text-center">{t("dashboard.moodPicker.title")}</p>
              <div className="flex justify-center gap-3">
                {MOOD_FACE_KEYS.map(({ emoji, key, storageLabel }) => {
                  const label = t(`dashboard.mood.${key}`);
                  return (
                    <button
                      key={storageLabel}
                      onClick={() => saveDailyMood(storageLabel)}
                      data-testid={`daily-mood-${storageLabel.toLowerCase().replace(" ","-")}`}
                      className="flex flex-col items-center gap-1.5 transition-all duration-200"
                    >
                      <motion.div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                        style={{ backgroundColor: dailyMood === storageLabel ? "#2D3A2E" : "#1A1E1A", border: `2px solid ${dailyMood === storageLabel ? "#8FA680" : "#2D3A2E"}` }}
                        whileTap={{ scale: 0.9 }}
                      >
                        {emoji}
                      </motion.div>
                      <span className="text-[10px] text-[#7A8A72]">{label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bad Mood Support Modal */}
      <AnimatePresence>
        {badMoodModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(26,30,26,0.92)" }}
            onClick={() => setBadMoodModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: "#2D2420", border: "0.5px solid #4D3020",
                borderRadius: 20, padding: 22, width: "100%", maxWidth: 340,
              }}
              data-testid="bad-mood-modal"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#E8EDE3", fontWeight: 700 }}>
                  {t("dashboard.badMoodModal.title")}
                </h2>
                <button
                  onClick={() => setBadMoodModalOpen(false)}
                  aria-label={t("common.close")}
                  style={{ color: "#7A8A72", background: "none", border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1 }}
                >×</button>
              </div>
              <p style={{ fontSize: 14, color: "#A3B197", lineHeight: 1.65, marginBottom: 20 }}>
                {t("dashboard.badMoodModal.body")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={() => { setBadMoodModalOpen(false); setBreathingOpen(true); }}
                  style={{
                    background: "#2D4A3E", color: "#E8EDE3", border: "none",
                    borderRadius: 12, padding: "12px 16px", fontSize: 14, cursor: "pointer",
                    textAlign: "left", WebkitTapHighlightColor: "transparent",
                  }}
                  data-testid="bad-mood-breathe"
                >
                  🌬️ {t("dashboard.badMoodModal.breathe")}
                </button>
                <button
                  onClick={() => { setBadMoodModalOpen(false); localStorage.setItem("practice_tab","journal"); localStorage.setItem("journal_open_new","1"); setLocation("/practice"); }}
                  style={{
                    background: "transparent", color: "#8FA680",
                    border: "1px solid #3D4D35",
                    borderRadius: 12, padding: "12px 16px", fontSize: 14, cursor: "pointer",
                    textAlign: "left", WebkitTapHighlightColor: "transparent",
                  }}
                  data-testid="bad-mood-journal"
                >
                  ✏️ {t("dashboard.badMoodModal.journal")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lesson reader */}
      <AnimatePresence>
        {activLesson && <LessonReader lesson={activLesson} onClose={() => setActivLesson(null)} />}
      </AnimatePresence>

      {/* ── Intention follow-up advice modal ────────────────────────── */}
      <AnimatePresence>
        {intentionAdviceOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
          >
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="w-full max-w-md bg-[#222822] border border-[#2D3A2E] rounded-2xl p-6 space-y-4"
              data-testid="intention-advice-modal"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">🌱</div>
                <p className="font-heading font-bold text-lg text-[#E8EDE3]">{t("dashboard.intentionAdvice.modalTitle")}</p>
                <p className="text-sm text-[#A3B197] mt-2 leading-relaxed">{t(intentionAdviceKey)}</p>
              </div>
              <button
                onClick={() => { setIntentionAdviceOpen(false); setBreathingOpen(true); }}
                className="w-full h-11 rounded-xl border border-[#4A5D3E] text-[#A3B197] text-sm font-medium hover:bg-[#1E241E] transition-colors"
                data-testid="advice-start-breathing"
              >
                {t("dashboard.intentionAdvice.startBreathing")}
              </button>
              <button
                onClick={() => setIntentionAdviceOpen(false)}
                className="w-full h-11 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors"
                data-testid="advice-lets-go"
              >
                {t("dashboard.intentionAdvice.letsGo")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <WoopWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onCreated={handleCreated} />
      {breathingOpen && <BreathingModal onClose={() => setBreathingOpen(false)} />}
      {movementSessionOpen && (
        <MovementSession
          onClose={() => setMovementSessionOpen(false)}
          onComplete={() => setMovementSessionOpen(false)}
        />
      )}
      <DisclaimerBanner userId={user?.id ?? ""} onDismissed={handleDisclaimerDismissed} />
      {showOnboarding && <OnboardingFlow onComplete={() => setShowOnboarding(false)} />}
      <BottomNav />
    </motion.div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────

function MoodAdaptiveCard({ mood, onBreathing, onWoop, onDismiss, t }: {
  mood: number; onBreathing: () => void; onWoop: () => void; onDismiss: () => void;
  t: (key: string) => string;
}) {
  if (mood <= 2) return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "#2D2420", borderColor: "#4D3020" }} data-testid="mood-card-low">
      <div className="flex items-start gap-4">
        <motion.div className="w-12 h-12 rounded-full bg-[#3D2820] flex items-center justify-center shrink-0 text-2xl"
          animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>🫁</motion.div>
        <div>
          <h3 className="font-heading font-bold text-lg text-[#E8EDE3]">{t("dashboard.moodCard.low.title")}</h3>
          <p className="text-sm text-[#C8A090] mt-1 leading-relaxed">{t("dashboard.moodCard.low.body")}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button onClick={onBreathing} className="w-full h-11 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors" data-testid="mood-card-cta-breathe">{t("dashboard.moodCard.low.breathe")}</button>
        <button onClick={onDismiss} className="w-full h-10 rounded-xl text-[#A3B197] text-sm font-medium hover:text-[#C8D5B9] transition-colors" data-testid="mood-card-dismiss">{t("dashboard.moodCard.low.dismiss")}</button>
      </div>
    </div>
  );
  if (mood === 3) return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "#222822", borderColor: "#2D3A2E" }} data-testid="mood-card-neutral">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[#2D3A2E] flex items-center justify-center shrink-0 text-2xl">🌱</div>
        <div>
          <h3 className="font-heading font-bold text-lg text-[#E8EDE3]">{t("dashboard.moodCard.neutral.title")}</h3>
          <p className="text-sm text-[#A3B197] mt-1 leading-relaxed">{t("dashboard.moodCard.neutral.body")}</p>
        </div>
      </div>
      <button onClick={onWoop} className="w-full h-11 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors" data-testid="mood-card-cta-woop">{t("dashboard.moodCard.neutral.cta")}</button>
    </div>
  );
  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "#1E3020", borderColor: "#2D4A2E" }} data-testid="mood-card-high">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[#2D4A2E] flex items-center justify-center shrink-0 text-2xl">✨</div>
        <div>
          <h3 className="font-heading font-bold text-lg text-[#E8EDE3]">{t("dashboard.moodCard.high.title")}</h3>
          <p className="text-sm text-[#A3C897] mt-1 leading-relaxed">{t("dashboard.moodCard.high.body")}</p>
        </div>
      </div>
      <button onClick={onWoop} className="w-full h-11 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors" data-testid="mood-card-cta-woop-high">{t("dashboard.moodCard.high.cta")}</button>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, testId }: { icon: LucideIcon; label: string; value: string; color: string; testId: string; }) {
  return (
    <div className="bg-[#222822] rounded-2xl border border-[#2D3A2E] p-4 flex items-center gap-3" data-testid={testId}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#7A8A72] truncate">{label}</p>
        <p className="text-lg font-heading font-bold text-[#E8EDE3] tabular-nums truncate">{value}</p>
      </div>
    </div>
  );
}

function MoodTrendSection({ points, direction, t }: { points: ReturnType<typeof moodTrend>; direction: ReturnType<typeof moodDirection>; t: (key: string) => string; }) {
  const message = direction === "improving" ? { icon: TrendingDown, text: t("dashboard.moodTrend.improving"), color: "#7AC47A" }
    : direction === "worse" ? { icon: TrendingUp, text: t("dashboard.moodTrend.worse"), color: "#D4806A" }
    : direction === "steady" ? { icon: Minus, text: t("dashboard.moodTrend.steady"), color: "#A3B197" } : null;
  return (
    <div>
      <div className="flex items-end justify-between gap-2 h-24" data-testid="mood-trend-chart">
        {points.map((p) => {
          const has = p.avg !== null;
          const heightPct = has ? Math.max(8, (1 - ((p.avg as number) - 1) / 9) * 100) : 0;
          return (
            <div key={p.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
              <div className="flex-1 w-full flex items-end justify-center">
                {has ? (
                  <div className="flex flex-col items-center" style={{ height: `${heightPct}%` }} data-testid={`mood-dot-${p.label.toLowerCase()}`}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#8FA680" }} title={`${p.avg}/10`} />
                    <div className="w-px flex-1 bg-[#2D3A2E]" />
                  </div>
                ) : <span className="text-[#2D3A2E] text-xs mb-1">·</span>}
              </div>
              <span className={`text-xs ${p.isFuture ? "text-[#2D3A2E]" : "text-[#7A8A72]"}`}>{p.label}</span>
            </div>
          );
        })}
      </div>
      {message && (
        <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: message.color }} data-testid="mood-trend-message">
          <message.icon className="w-4 h-4 shrink-0" /><span>{message.text}</span>
        </div>
      )}
    </div>
  );
}
