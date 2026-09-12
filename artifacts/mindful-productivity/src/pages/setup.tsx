import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, Heart, TrendingUp, Sparkles, Check } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import supabase from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGE_OPTIONS, type LanguageCode } from "@/lib/translations";

// Goals: IDs are stable storage values; labels are looked up via t()
const GOALS = [
  {
    id: "procrastination",
    labelKey: "setup.goal.procrastination.label",
    descKey: "setup.goal.procrastination.desc",
    icon: Clock,
    color: "#8FA680",
  },
  {
    id: "anxiety",
    labelKey: "setup.goal.anxiety.label",
    descKey: "setup.goal.anxiety.desc",
    icon: Heart,
    color: "#D4806A",
  },
  {
    id: "productivity",
    labelKey: "setup.goal.productivity.label",
    descKey: "setup.goal.productivity.desc",
    icon: TrendingUp,
    color: "#7AC47A",
  },
  {
    id: "all",
    labelKey: "setup.goal.all.label",
    descKey: "setup.goal.all.desc",
    icon: Sparkles,
    color: "#B08AD4",
  },
] as const;

// Blockers: IDs are stable storage values (kebab-case); labels are looked up via t()
const BLOCKERS: { id: string; key: string }[] = [
  { id: "Fear of failure",             key: "setup.blocker.fear-of-failure" },
  { id: "Perfectionism",               key: "setup.blocker.perfectionism" },
  { id: "Overwhelm",                   key: "setup.blocker.overwhelm" },
  { id: "Lack of motivation",          key: "setup.blocker.lack-of-motivation" },
  { id: "Distractions",               key: "setup.blocker.distractions" },
  { id: "Anxiety",                     key: "setup.blocker.anxiety" },
  { id: "Don't know where to start",  key: "setup.blocker.dont-know-where-to-start" },
  { id: "Too tired",                   key: "setup.blocker.too-tired" },
];

// Moods: scores are stable storage values; labels are looked up via t()
const MOODS = [
  { score: 1, emoji: "😞", labelKey: "setup.mood.1", color: "#D4806A" },
  { score: 2, emoji: "😔", labelKey: "setup.mood.2", color: "#D4A06A" },
  { score: 3, emoji: "😐", labelKey: "setup.mood.3", color: "#D4B96A" },
  { score: 4, emoji: "🙂", labelKey: "setup.mood.4", color: "#8FA680" },
  { score: 5, emoji: "😄", labelKey: "setup.mood.5", color: "#7AC47A" },
];

export default function SetupPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t, setLanguage, language } = useLanguage();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);

  const defaultName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.display_name ||
    (user?.email ? user.email.split("@")[0] : "");

  // Step 0 – language (tracks selected LanguageCode; mirrors global language state)
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(language);
  // Step 1 – about you
  const [displayName, setDisplayName] = useState<string>(defaultName);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  // Step 2 – goal
  const [primaryGoal, setPrimaryGoal] = useState("");
  // Step 3 – blockers (stored as English IDs for backend)
  const [blockers, setBlockers] = useState<string[]>([]);
  // Step 4 – mood
  const [mood, setMood] = useState<number | null>(null);

  const canProceed = [
    true,
    displayName.trim().length > 0 && ageConfirmed,
    primaryGoal !== "",
    blockers.length > 0,
    mood !== null,
  ][step];

  function goBack() {
    setDirection(-1);
    setStep((s) => s - 1);
  }

  function goNext() {
    if (step < 4) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      handleComplete();
    }
  }

  function handleLanguageSelect(code: LanguageCode) {
    setSelectedLanguage(code);
    setLanguage(code);
  }

  async function handleComplete() {
    setSaving(true);
    try {
      // Language already persisted via setLanguage; write once more for safety
      try { localStorage.setItem("mindful_language", selectedLanguage); } catch {}
      await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim(),
          age_confirmed: true,
          primary_goal: primaryGoal,
          procrastination_reasons: blockers,
          initial_mood: String(mood),
          language: selectedLanguage,
          profile_completed: true,
        },
      });
      setLocation("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  function toggleBlocker(id: string) {
    setBlockers((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev,
    );
  }

  const stepTitles = [
    t("setup.step0.title"),
    t("setup.step1.title"),
    t("setup.step2.title"),
    t("setup.step3.title"),
    t("setup.step4.title"),
  ];

  return (
    <div className="min-h-screen bg-[#1A1E1A] flex flex-col">
      {/* Progress dots – 5 steps */}
      <div className="flex justify-center items-center gap-2 pt-14 pb-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? 24 : 8,
              height: 8,
              backgroundColor: i <= step ? "#8FA680" : "#2D3A2E",
            }}
          />
        ))}
      </div>

      {/* Step label */}
      <p className="text-center text-xs text-[#7A8A72] uppercase tracking-widest mt-2">
        {t("setup.step").replace("{n}", String(step + 1))}
      </p>

      {/* Animated step content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d * 40, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -40, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="px-5 max-w-lg mx-auto w-full pt-6"
          >
            <h1 className="font-heading text-2xl font-bold text-[#E8EDE3] text-center mb-2">
              {stepTitles[step]}
            </h1>

            {/* ── Step 0: Language ──────────────────────────────────────── */}
            {step === 0 && (
              <>
                <p className="text-sm text-[#7A8A72] text-center mb-6">
                  {t("setup.step0.subtitle")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {LANGUAGE_OPTIONS.map(({ code, flag, label }) => {
                    const selected = selectedLanguage === code;
                    return (
                      <button
                        key={code}
                        onClick={() => handleLanguageSelect(code)}
                        data-testid={`lang-${code}`}
                        style={{
                          padding: 14, borderRadius: 12,
                          background: selected ? "#2D3A2E" : "#222822",
                          border: `1px solid ${selected ? "#8FA680" : "#2D3A2E"}`,
                          display: "flex", alignItems: "center", gap: 10,
                          cursor: "pointer", width: "100%", textAlign: "left",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        <span style={{ fontSize: 24, flexShrink: 0 }}>{flag}</span>
                        <span style={{ fontSize: 13, color: "#C8D5B9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {label}
                        </span>
                        {selected && (
                          <Check className="w-4 h-4 text-[#8FA680] ml-auto shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── Step 1: About You ─────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5 mt-6">
                <div className="space-y-2">
                  <label className="text-sm text-[#C8D5B9] font-medium">
                    {t("setup.step1.nameLabel")}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("setup.step1.namePlaceholder")}
                    className="w-full h-12 rounded-xl bg-[#222822] border border-[#2D3A2E] px-4 text-[#E8EDE3] placeholder:text-[#7A8A72] focus:outline-none focus:border-[#8FA680] transition-colors"
                    data-testid="input-display-name"
                    maxLength={50}
                  />
                </div>

                <label
                  className="flex items-start gap-3 cursor-pointer bg-[#222822] border border-[#2D3A2E] rounded-xl p-4 transition-colors hover:border-[#4A5D3E]"
                  data-testid="label-age-confirm"
                >
                  <div
                    className="mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all"
                    style={{
                      backgroundColor: ageConfirmed ? "#4A5D3E" : "transparent",
                      borderColor: ageConfirmed ? "#8FA680" : "#2D3A2E",
                    }}
                  >
                    {ageConfirmed && <Check className="w-3 h-3 text-[#E8EDE3]" />}
                  </div>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)}
                    data-testid="checkbox-age-confirm"
                  />
                  <span className="text-sm text-[#A3B197] leading-relaxed">
                    {t("setup.step1.ageConfirm").replace("{age}", t("setup.step1.ageStrong"))}
                  </span>
                </label>
              </div>
            )}

            {/* ── Step 2: Goal ──────────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-3 mt-6">
                <p className="text-sm text-[#7A8A72] text-center mb-6">
                  {t("setup.step2.subtitle")}
                </p>
                {GOALS.map(({ id, labelKey, descKey, icon: Icon, color }) => {
                  const selected = primaryGoal === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setPrimaryGoal(id)}
                      data-testid={`goal-${id}`}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left"
                      style={{
                        backgroundColor: selected ? "#2D3A2E" : "#222822",
                        borderColor: selected ? "#8FA680" : "#2D3A2E",
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}22` }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#E8EDE3]">{t(labelKey)}</p>
                        <p className="text-xs text-[#7A8A72] mt-0.5">{t(descKey)}</p>
                      </div>
                      {selected && (
                        <div className="w-5 h-5 rounded-full bg-[#8FA680] flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-[#1A1E1A]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Step 3: Blockers ──────────────────────────────────────── */}
            {step === 3 && (
              <div className="mt-6">
                <p className="text-sm text-[#7A8A72] text-center mb-6">
                  {t("setup.step3.subtitle")}
                </p>
                <div className="flex flex-wrap gap-2.5 justify-center">
                  {BLOCKERS.map(({ id, key }) => {
                    const selected = blockers.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleBlocker(id)}
                        data-testid={`blocker-${id.replace(/\s+/g, "-").toLowerCase()}`}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200"
                        style={{
                          backgroundColor: selected ? "#2D3A2E" : "#222822",
                          borderColor: selected ? "#8FA680" : "#2D3A2E",
                          color: selected ? "#E8EDE3" : "#A3B197",
                        }}
                      >
                        {t(key)}
                      </button>
                    );
                  })}
                </div>
                {blockers.length > 0 && (
                  <p className="text-center text-xs text-[#7A8A72] mt-4">
                    {t("setup.step3.selected").replace("{n}", String(blockers.length))}
                  </p>
                )}
              </div>
            )}

            {/* ── Step 4: Mood ──────────────────────────────────────────── */}
            {step === 4 && (
              <div className="mt-6">
                <p className="text-sm text-[#7A8A72] text-center mb-8">
                  {t("setup.step4.subtitle")}
                </p>
                <div className="flex justify-center gap-3 flex-wrap">
                  {MOODS.map(({ score, emoji, labelKey, color }) => {
                    const selected = mood === score;
                    return (
                      <button
                        key={score}
                        onClick={() => setMood(score)}
                        data-testid={`mood-${score}`}
                        className="flex flex-col items-center gap-2 transition-all duration-200"
                      >
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-200"
                          style={{
                            backgroundColor: selected ? `${color}33` : "#222822",
                            border: `2px solid ${selected ? color : "#2D3A2E"}`,
                            transform: selected ? "scale(1.08)" : "scale(1)",
                          }}
                        >
                          {emoji}
                        </div>
                        <span
                          className="text-xs font-medium"
                          style={{ color: selected ? color : "#7A8A72" }}
                        >
                          {t(labelKey)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div
        className="onboarding-bottom-actions p-5 max-w-lg mx-auto w-full flex items-center gap-3"
        style={{ "--onboarding-action-base-padding": "2rem" } as React.CSSProperties}
        data-testid="setup-bottom-actions"
      >
        {step > 0 && (
          <button
            onClick={goBack}
            className="w-12 h-12 rounded-xl border border-[#2D3A2E] flex items-center justify-center text-[#7A8A72] hover:text-[#C8D5B9] hover:border-[#4A5D3E] transition-all"
            data-testid="button-back"
            aria-label={t("setup.nav.back")}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={goNext}
          disabled={!canProceed || saving}
          data-testid="button-next"
          className="flex-1 h-12 rounded-xl font-medium text-sm transition-all duration-200"
          style={{
            backgroundColor: canProceed && !saving ? "#4A5D3E" : "#222822",
            color: canProceed && !saving ? "#E8EDE3" : "#7A8A72",
            border: `1px solid ${canProceed && !saving ? "transparent" : "#2D3A2E"}`,
          }}
        >
          {step === 4 ? (saving ? t("setup.nav.saving") : t("setup.nav.getStarted")) : t("setup.nav.next")}
        </button>
      </div>
    </div>
  );
}
