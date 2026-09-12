import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Sparkles, HeartPulse, Brain, Zap, CloudRain, Minus, Smile } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import supabase from "@/lib/supabase";

const STORAGE_KEY_PREFIX = "onboarding_completed_";

export function onboardingCompleted(userId: string): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY_PREFIX + userId);
  } catch {
    return false;
  }
}

function markOnboardingDone(userId: string) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, "1");
  } catch {
    // ignore
  }
}

interface Mood {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  bg: string;
  border: string;
  activeBorder: string;
  glow: string;
}

const MOODS: Mood[] = [
  {
    id: "stressed",
    labelKey: "onboarding.mood.stressed",
    icon: Zap,
    bg: "#2D2420",
    border: "#4D3020",
    activeBorder: "#D4806A",
    glow: "rgba(212,128,106,0.15)",
  },
  {
    id: "anxious",
    labelKey: "onboarding.mood.anxious",
    icon: CloudRain,
    bg: "#2D2040",
    border: "#4D2050",
    activeBorder: "#B08AD4",
    glow: "rgba(176,138,212,0.15)",
  },
  {
    id: "okay",
    labelKey: "onboarding.mood.okay",
    icon: Minus,
    bg: "#2D3A2E",
    border: "#3D4D35",
    activeBorder: "#8FA680",
    glow: "rgba(143,166,128,0.15)",
  },
  {
    id: "good",
    labelKey: "onboarding.mood.good",
    icon: Smile,
    bg: "#1E3020",
    border: "#2D4D2D",
    activeBorder: "#7AC47A",
    glow: "rgba(122,196,122,0.15)",
  },
];

interface Feature {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  color: string;
  bg: string;
}

const FEATURES: Feature[] = [
  {
    icon: Sparkles,
    titleKey: "onboarding.feature.intention.title",
    descKey: "onboarding.feature.intention.desc",
    color: "#D4B96A",
    bg: "#3D3520",
  },
  {
    icon: HeartPulse,
    titleKey: "onboarding.feature.anxiety.title",
    descKey: "onboarding.feature.anxiety.desc",
    color: "#B08AD4",
    bg: "#2D2040",
  },
  {
    icon: Brain,
    titleKey: "onboarding.feature.coach.title",
    descKey: "onboarding.feature.coach.desc",
    color: "#8FA680",
    bg: "#2D3A2E",
  },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -60, opacity: 0 }),
};

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [screen, setScreen] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function navigate(to: number) {
    setDirection(to > screen ? 1 : -1);
    setScreen(to);
  }

  function skip() {
    finish(null);
  }

  async function finish(mood: string | null) {
    if (saving) return;
    setSaving(true);
    try {
      if (mood) {
        // Persist initial mood to user metadata — no schema migration needed
        await supabase.auth.updateUser({ data: { initial_mood: mood } });
      }
    } catch {
      // Best-effort — don't block completion on network failure
    } finally {
      if (user) markOnboardingDone(user.id);
      setSaving(false);
      onComplete();
    }
  }

  const TOTAL = 3;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1A1E1A] px-6"
      data-testid="onboarding-flow"
    >
      <div className="w-full max-w-sm flex flex-col" style={{ minHeight: 480 }}>
        {/* Screen area */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={screen}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 flex flex-col"
              data-testid={`onboarding-screen-${screen}`}
            >
              {screen === 0 && <Screen1 />}
              {screen === 1 && <Screen2 />}
              {screen === 2 && (
                <Screen3
                  selectedMood={selectedMood}
                  onSelect={setSelectedMood}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2 my-6">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === screen ? 24 : 8,
                height: 8,
                backgroundColor: i === screen ? "#8FA680" : "#2D3A2E",
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        {screen < 2 ? (
          <div
            className="onboarding-bottom-actions flex flex-col gap-3"
            data-testid="onboarding-bottom-actions"
          >
            <button
              onClick={() => navigate(screen + 1)}
              className="w-full h-12 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors"
              data-testid="button-onboarding-next"
            >
              {t("onboarding.next")}
            </button>
            <button
              onClick={skip}
              className="w-full h-10 text-sm text-[#7A8A72] hover:text-[#A3B197] transition-colors"
              data-testid="button-onboarding-skip"
            >
              {t("onboarding.skip")}
            </button>
          </div>
        ) : (
          <div
            className="onboarding-bottom-actions flex flex-col gap-3"
            data-testid="onboarding-bottom-actions"
          >
            <button
              onClick={() => void finish(selectedMood)}
              disabled={saving}
              className="w-full h-12 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors disabled:opacity-60"
              data-testid="button-onboarding-start"
            >
              {saving ? t("onboarding.settingUp") : t("onboarding.getStarted")}
            </button>
            <button
              onClick={skip}
              className="w-full h-10 text-sm text-[#7A8A72] hover:text-[#A3B197] transition-colors"
              data-testid="button-onboarding-skip-last"
            >
              {t("onboarding.skip")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Screen1() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center text-center h-full py-4 gap-5">
      <div className="w-20 h-20 rounded-2xl bg-[#2D3A2E] flex items-center justify-center">
        <Leaf className="w-10 h-10 text-[#8FA680]" />
      </div>
      <div className="space-y-2">
        <h1
          className="font-heading font-bold text-[#E8EDE3]"
          style={{ fontSize: 24 }}
        >
          {t("onboarding.screen1.title")}
        </h1>
        <p className="text-[#A3B197]" style={{ fontSize: 14 }}>
          {t("onboarding.screen1.subtitle")}
        </p>
      </div>
      <p
        className="text-[#7A8A72] text-center leading-relaxed max-w-xs"
        style={{ fontSize: 13 }}
      >
        {t("onboarding.screen1.body")}
      </p>
    </div>
  );
}

function Screen2() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col h-full py-4 gap-4">
      <h2
        className="font-heading font-bold text-[#E8EDE3] text-center"
        style={{ fontSize: 20 }}
      >
        {t("onboarding.screen2.title")}
      </h2>
      <div className="flex flex-col gap-3 flex-1 justify-center">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.titleKey}
              className="flex items-center gap-4 p-4 rounded-2xl bg-[#222822] border border-[#2D3A2E]"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: f.bg }}
              >
                <Icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-[#E8EDE3] text-sm leading-tight">
                  {t(f.titleKey)}
                </p>
                <p className="text-xs text-[#7A8A72] mt-0.5 leading-relaxed">
                  {t(f.descKey)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Screen3({
  selectedMood,
  onSelect,
}: {
  selectedMood: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col h-full py-4 gap-4">
      <div className="text-center space-y-1.5">
        <h2
          className="font-heading font-bold text-[#E8EDE3]"
          style={{ fontSize: 20 }}
        >
          {t("onboarding.screen3.title")}
        </h2>
        <p className="text-[#7A8A72]" style={{ fontSize: 13 }}>
          {t("onboarding.screen3.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1 content-center">
        {MOODS.map((m) => {
          const Icon = m.icon;
          const active = selectedMood === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              aria-pressed={active}
              data-testid={`mood-option-${m.id}`}
              className="flex flex-col items-center justify-center gap-2.5 rounded-2xl p-5 border-2 transition-all duration-300"
              style={{
                backgroundColor: m.bg,
                borderColor: active ? m.activeBorder : m.border,
                boxShadow: active ? `0 0 16px ${m.glow}` : "none",
              }}
            >
              <Icon
                className="w-8 h-8"
                style={{ color: active ? m.activeBorder : "#7A8A72" }}
              />
              <span
                className="text-sm font-medium transition-colors duration-300"
                style={{ color: active ? m.activeBorder : "#7A8A72" }}
              >
                {t(m.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
