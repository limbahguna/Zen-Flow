import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { createAnxietyCheck } from "@/lib/anxietyChecks";
import type { Feeling } from "@/lib/anxietyChecks";
import { trackEvent } from "@/lib/analytics";

// ─── Constants ──────────────────────────────────────────────────────────────

const ROUNDS = 3;

interface PhaseConfig {
  key: "inhale" | "hold" | "exhale";
  labelKey: string;
  duration: number;
  toScale: number;
}

const PHASES: PhaseConfig[] = [
  { key: "inhale", labelKey: "breathing.phase.inhale", duration: 4, toScale: 1.0 },
  { key: "hold",   labelKey: "breathing.phase.hold",   duration: 7, toScale: 1.0 },
  { key: "exhale", labelKey: "breathing.phase.exhale", duration: 8, toScale: 0.6 },
];

const TOTAL_PHASES = ROUNDS * PHASES.length;

// 25 stars — hardcoded for determinism (no Math.random on render)
const STARS = [
  { t: 4,  l: 8,  s: 2, d: 2.5, dl: 0.0 },
  { t: 9,  l: 22, s: 2, d: 3.2, dl: 0.4 },
  { t: 3,  l: 38, s: 3, d: 2.8, dl: 1.1 },
  { t: 15, l: 5,  s: 2, d: 3.5, dl: 0.7 },
  { t: 6,  l: 52, s: 2, d: 2.3, dl: 1.8 },
  { t: 20, l: 70, s: 3, d: 3.8, dl: 0.2 },
  { t: 8,  l: 82, s: 2, d: 2.6, dl: 2.1 },
  { t: 25, l: 91, s: 2, d: 3.1, dl: 0.9 },
  { t: 12, l: 65, s: 2, d: 2.9, dl: 1.5 },
  { t: 30, l: 45, s: 2, d: 3.6, dl: 0.3 },
  { t: 18, l: 30, s: 3, d: 2.2, dl: 2.7 },
  { t: 35, l: 15, s: 2, d: 3.4, dl: 1.2 },
  { t: 22, l: 77, s: 2, d: 2.7, dl: 0.6 },
  { t: 40, l: 58, s: 2, d: 3.0, dl: 1.9 },
  { t: 7,  l: 95, s: 2, d: 2.4, dl: 2.4 },
  { t: 28, l: 42, s: 3, d: 3.7, dl: 0.8 },
  { t: 14, l: 12, s: 2, d: 2.1, dl: 1.6 },
  { t: 38, l: 88, s: 2, d: 3.3, dl: 0.1 },
  { t: 5,  l: 72, s: 2, d: 2.6, dl: 2.2 },
  { t: 32, l: 28, s: 2, d: 3.9, dl: 1.0 },
  { t: 10, l: 48, s: 3, d: 2.4, dl: 2.9 },
  { t: 44, l: 35, s: 2, d: 3.1, dl: 0.5 },
  { t: 16, l: 62, s: 2, d: 2.8, dl: 1.7 },
  { t: 48, l: 18, s: 2, d: 3.5, dl: 2.3 },
  { t: 26, l: 85, s: 2, d: 2.2, dl: 1.4 },
];

// 8 exhale particles with fixed horizontal drift values
const PARTICLE_DRIFTS = [-28, -18, -8, 2, 12, 22, -14, 8];

type PostMood  = "much_better" | "little_better" | "same";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface BreathingExerciseProps {
  onFinish: (completed: boolean) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BreathingExercise({ onFinish }: BreathingExerciseProps) {
  const { t } = useLanguage();
  const [phaseIdx, setPhaseIdx]       = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(PHASES[0].duration);
  const [isDone, setIsDone]           = useState(false);
  const [postMood, setPostMood]       = useState<PostMood | null>(null);
  const [muted, setMuted]                 = useState(false);
  const [celebrate, setCelebrate]         = useState(false);
  const [shootingStar, setShootingStar]   = useState<{ id: number; top: number; left: number } | null>(null);
  const [feedbackMsg, setFeedbackMsg]     = useState<string | null>(null);
  const { user } = useAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);

  const phase  = PHASES[phaseIdx % PHASES.length];
  const round  = Math.floor(phaseIdx / PHASES.length);
  const isHold = phase.key === "hold";

  // ── Wake lock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if ("wakeLock" in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).wakeLock.request("screen")
        .then((wl: unknown) => { wakeLockRef.current = wl; })
        .catch(() => {});
    }
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wakeLockRef.current?.release?.().catch(() => {});
    };
  }, []);

  // ── Timer + phase management ───────────────────────────────────────────────
  useEffect(() => {
    if (isDone) return;

    if (phaseIdx >= TOTAL_PHASES) {
      setIsDone(true);
      trackEvent("breathing_completed", { exercise: "guided_478" });
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2000);
      if (audioRef.current) {
        let vol = audioRef.current.volume;
        const fadeOut = setInterval(() => {
          vol -= 0.04;
          if (vol <= 0) {
            clearInterval(fadeOut);
            if (audioRef.current) { audioRef.current.pause(); }
          } else {
            if (audioRef.current) audioRef.current.volume = vol;
          }
        }, 50);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wakeLockRef.current?.release?.().catch(() => {});
      return;
    }

    const dur = PHASES[phaseIdx % PHASES.length].duration;
    setSecondsLeft(dur);

    const iv = setInterval(() => setSecondsLeft(s => (s <= 1 ? 0 : s - 1)), 1000);
    const to = setTimeout(() => setPhaseIdx(i => i + 1), dur * 1000);
    return () => { clearInterval(iv); clearTimeout(to); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIdx, isDone]);

  // ── Shooting star ─────────────────────────────────────────────────────────
  const shootRef = useRef(0);
  useEffect(() => {
    if (isDone) return;
    const schedule = () => {
      shootRef.current = window.setTimeout(() => {
        setShootingStar({ id: Date.now(), top: 5 + Math.random() * 18, left: 8 + Math.random() * 55 });
        setTimeout(() => setShootingStar(null), 1100);
        schedule();
      }, 15000 + Math.random() * 5000);
    };
    schedule();
    return () => clearTimeout(shootRef.current);
  }, [isDone]);

  // ── Auto-play nature audio with fade in/out ───────────────────────────────
  useEffect(() => {
    const a = new Audio('/audio/nature.mp3');
    a.loop = true;
    a.volume = 0;
    a.preload = 'auto';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a as any).playsInline = true;
    audioRef.current = a;

    const playPromise = a.play();
    if (playPromise) {
      playPromise.then(() => {
        let vol = 0;
        const fadeIn = setInterval(() => {
          vol += 0.02;
          if (vol >= 0.4) { vol = 0.4; clearInterval(fadeIn); }
          if (a) a.volume = vol;
        }, 50);
      }).catch(() => {});
    }

    return () => {
      if (a) {
        let vol = a.volume;
        const fadeOut = setInterval(() => {
          vol -= 0.04;
          if (vol <= 0) {
            clearInterval(fadeOut);
            a.pause();
            a.src = '';
          } else {
            a.volume = vol;
          }
        }, 50);
      }
    };
  }, []);

  // ── Mute toggle ───────────────────────────────────────────────────────────
  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setMuted(m => !m);
    }
  };

  function handleEndEarly() {
    if (audioRef.current) {
      let vol = audioRef.current.volume;
      const fadeOut = setInterval(() => {
        vol -= 0.04;
        if (vol <= 0) {
          clearInterval(fadeOut);
          if (audioRef.current) { audioRef.current.pause(); }
        } else {
          if (audioRef.current) audioRef.current.volume = vol;
        }
      }, 50);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wakeLockRef.current?.release?.().catch(() => {});
    onFinish(false);
  }

  function handleReturnToDashboard() {
    onFinish(true);
  }

  async function handleMoodSelect(mood: PostMood) {
    setPostMood(mood);
    const msgKey: Record<PostMood, string> = {
      much_better:    "breathing.postMood.much_better.msg",
      little_better:  "breathing.postMood.little_better.msg",
      same:           "breathing.postMood.same.msg",
    };
    setFeedbackMsg(t(msgKey[mood]));
    if (user) {
      const feelingMap: Record<PostMood, Feeling> = {
        much_better: "calm",
        little_better: "neutral",
        same: "neutral",
      };
      const intensityMap: Record<PostMood, number> = {
        much_better: 2,
        little_better: 4,
        same: 5,
      };
      try {
        await createAnxietyCheck(user.id, {
          taskId: null,
          feeling: feelingMap[mood],
          intensity: intensityMap[mood],
          breathingOffered: true,
          breathingCompleted: true,
        });
      } catch { /* best-effort */ }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden select-none"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1532978379173-523e16f371f2?w=800&q=80')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      data-testid="breathing-exercise"
    >
      {/* Photo overlay so text stays readable */}
      <div className="absolute inset-0" style={{ background: "rgba(6, 13, 31, 0.62)" }} />
      {/* ── Stars ─────────────────────────────────────────────────────────── */}
      {STARS.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{ top: `${s.t}%`, left: `${s.l}%`, width: s.s, height: s.s }}
          animate={{ opacity: [0.15, 0.75, 0.15] }}
          transition={{
            duration: celebrate ? s.d * 0.4 : s.d,
            repeat: Infinity,
            ease: "easeInOut",
            delay: s.dl,
          }}
        />
      ))}

      {/* ── Moon ──────────────────────────────────────────────────────────── */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "8%",
          right: "15%",
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "#C8D5B9",
          boxShadow:
            "0 0 20px rgba(200,213,185,0.3), 0 0 60px rgba(200,213,185,0.1)",
        }}
      >
        {/* Crescent mask */}
        <div
          style={{
            position: "absolute",
            top: -5,
            right: -10,
            width: 35,
            height: 35,
            borderRadius: "50%",
            background: "#060D1F",
          }}
        />
      </div>

      {/* ── Moon reflection on water ───────────────────────────────────────── */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          bottom: 32,
          right: "14%",
          width: 4,
          height: 44,
          background: "linear-gradient(180deg, rgba(200,213,185,0.2), transparent)",
          filter: "blur(2px)",
          borderRadius: 2,
        }}
        animate={{ opacity: [0.3, 0.65, 0.3], height: [44, 54, 44] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Waves ─────────────────────────────────────────────────────────── */}
      {(
        [
          { h: 70, color: "rgba(13,59,62,0.6)",  speed: 8,  bottom: 0,  delay: 0   },
          { h: 55, color: "rgba(18,73,77,0.4)",  speed: 6,  bottom: 10, delay: -2  },
          { h: 45, color: "rgba(26,92,96,0.3)",  speed: 10, bottom: 20, delay: -4  },
        ] as const
      ).map((w, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: "-5%",
            width: "110%",
            height: w.h,
            background: w.color,
            borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
            bottom: w.bottom,
          }}
          animate={{ x: ["-3%", "3%", "-3%"] }}
          transition={{
            duration: w.speed,
            repeat: Infinity,
            ease: "easeInOut",
            delay: w.delay,
          }}
        />
      ))}

      {/* ── Mountain silhouette ───────────────────────────────────────────── */}
      <svg
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        className="absolute pointer-events-none"
        style={{ bottom: 52, left: 0, right: 0, width: "100%", height: 100, opacity: 0.45 }}
        aria-hidden="true"
      >
        <path
          d="M0,100 L40,58 L80,78 L130,28 L180,68 L220,42 L260,63 L310,22 L355,52 L400,38 L400,100 Z"
          fill="#0A1520"
        />
      </svg>

      {/* ── Horizon glow ──────────────────────────────────────────────────── */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          bottom: 58,
          left: 0,
          right: 0,
          height: 80,
          background: "radial-gradient(ellipse at 50% 100%, rgba(143,166,128,0.07) 0%, transparent 70%)",
        }}
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Shooting star ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {shootingStar && (
          <motion.div
            key={shootingStar.id}
            className="absolute pointer-events-none rounded-full"
            style={{
              top: `${shootingStar.top}%`,
              left: `${shootingStar.left}%`,
              width: 2,
              height: 2,
              background: "white",
            }}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], x: 180, y: 90 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* ── Mute button ──────────────────────────────────────────────────── */}
      <button
        onClick={toggleMute}
        type="button"
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 60,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.3)',
          border: 'none',
          color: '#C8D5B9',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label={muted ? t("breathing.unmute") : t("breathing.mute")}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!isDone ? (
          /* ── Exercise ───────────────────────────────────────────────── */
          <motion.div
            key="exercise"
            className="absolute inset-0 flex flex-col items-center justify-center z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Phase label */}
            <AnimatePresence mode="wait">
              <motion.p
                key={phase.key + round}
                className="text-lg font-medium mb-10 tracking-wide"
                style={{ color: "#A3B197" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {t(phase.labelKey)}
              </motion.p>
            </AnimatePresence>

            {/* Orb area */}
            <div
              className="relative flex items-center justify-center"
              style={{ width: 240, height: 240 }}
            >
              {/* Outer ring 2 */}
              <motion.div
                key={`r2-${phaseIdx}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 210,
                  height: 210,
                  border: "1px solid rgba(143,166,128,0.08)",
                }}
                animate={
                  isHold
                    ? { scale: [0.95, 1.05, 0.95] }
                    : { scale: phase.toScale * 1.15 }
                }
                transition={
                  isHold
                    ? { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }
                    : { duration: phase.duration, ease: "easeInOut" }
                }
              />
              {/* Outer ring 1 */}
              <motion.div
                key={`r1-${phaseIdx}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 180,
                  height: 180,
                  border: "1px solid rgba(143,166,128,0.15)",
                }}
                animate={
                  isHold
                    ? { scale: [0.95, 1.05, 0.95] }
                    : { scale: phase.toScale * 1.1 }
                }
                transition={
                  isHold
                    ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
                    : { duration: phase.duration, ease: "easeInOut" }
                }
              />

              {/* Main orb */}
              <motion.div
                key={`orb-${phaseIdx}`}
                className="absolute rounded-full"
                style={{
                  width: 150,
                  height: 150,
                  background:
                    "radial-gradient(circle, rgba(200,213,185,0.85) 0%, rgba(143,166,128,0.35) 50%, transparent 70%)",
                }}
                animate={
                  isHold
                    ? {
                        scale: [1.0, 1.03, 1.0],
                        boxShadow: [
                          "0 0 60px rgba(143,166,128,0.4), 0 0 120px rgba(143,166,128,0.1)",
                          "0 0 70px rgba(143,166,128,0.55), 0 0 140px rgba(143,166,128,0.15)",
                          "0 0 60px rgba(143,166,128,0.4), 0 0 120px rgba(143,166,128,0.1)",
                        ],
                      }
                    : phase.key === "inhale"
                    ? {
                        scale: phase.toScale,
                        boxShadow: [
                          "0 0 30px rgba(143,166,128,0.2)",
                          "0 0 80px rgba(143,166,128,0.5), 0 0 160px rgba(143,166,128,0.15)",
                        ],
                      }
                    : {
                        scale: phase.toScale,
                        boxShadow: [
                          "0 0 80px rgba(143,166,128,0.5), 0 0 160px rgba(143,166,128,0.15)",
                          "0 0 15px rgba(143,166,128,0.1)",
                        ],
                      }
                }
                transition={
                  isHold
                    ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    : { duration: phase.duration, ease: "easeInOut" }
                }
              >
                {/* Countdown inside orb */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={secondsLeft}
                      className="font-heading font-bold tabular-nums"
                      style={{ fontSize: 36, color: "rgba(255,255,255,0.92)" }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {secondsLeft}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Exhale particles */}
              {phase.key === "exhale" &&
                PARTICLE_DRIFTS.map((drift, i) => (
                  <motion.div
                    key={`p-${phaseIdx}-${i}`}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: 3,
                      height: 3,
                      background: "rgba(143,166,128,0.55)",
                      bottom: 120,
                      left: 120,
                    }}
                    initial={{ y: 0, x: 0, opacity: 0.6, scale: 1 }}
                    animate={{ y: -120, x: drift, opacity: 0, scale: 0 }}
                    transition={{
                      duration: 2,
                      ease: "easeOut",
                      delay: i * 0.12,
                    }}
                  />
                ))}
            </div>

            {/* Round dots */}
            <div className="flex items-center gap-2 mt-12">
              {Array.from({ length: ROUNDS }).map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === round ? 24 : 8,
                    height: 8,
                    background: i <= round ? "#C8D5B9" : "#1A2830",
                  }}
                />
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "#3A5058" }}>
              {t("breathing.roundOf").replace("{round}", String(round + 1)).replace("{total}", String(ROUNDS))}
            </p>

            {/* End early */}
            <button
              onClick={handleEndEarly}
              className="mt-10 text-sm transition-colors duration-200 hover:opacity-70"
              style={{ color: "#334048" }}
              data-testid="button-breathing-end-early"
            >
              {t("breathing.endEarly")}
            </button>
          </motion.div>
        ) : (
          /* ── Completion screen ──────────────────────────────────────── */
          <motion.div
            key="done"
            className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            data-testid="breathing-complete"
          >
            {/* Glowing completion orb */}
            <motion.div
              className="rounded-full mb-8"
              style={{
                width: 120,
                height: 120,
                background:
                  "radial-gradient(circle, rgba(200,213,185,0.85) 0%, rgba(143,166,128,0.35) 50%, transparent 70%)",
              }}
              animate={{
                boxShadow: celebrate
                  ? [
                      "0 0 80px rgba(143,166,128,0.7), 0 0 160px rgba(143,166,128,0.3)",
                      "0 0 120px rgba(143,166,128,1.0), 0 0 240px rgba(143,166,128,0.5)",
                      "0 0 80px rgba(143,166,128,0.7), 0 0 160px rgba(143,166,128,0.3)",
                    ]
                  : [
                      "0 0 40px rgba(143,166,128,0.3), 0 0 80px rgba(143,166,128,0.1)",
                      "0 0 60px rgba(143,166,128,0.5), 0 0 120px rgba(143,166,128,0.15)",
                      "0 0 40px rgba(143,166,128,0.3), 0 0 80px rgba(143,166,128,0.1)",
                    ],
              }}
              transition={{ duration: celebrate ? 0.5 : 3, repeat: Infinity }}
            />

            <h2
              className="font-heading font-bold mb-1"
              style={{ fontSize: 28, color: "#E8EDE3" }}
            >
              {t("breathing.done.title")}
            </h2>
            <p className="text-sm mb-8" style={{ color: "#4A6070" }}>
              {t("breathing.done.subtitle")}
            </p>

            <p
              className="text-sm font-medium mb-4"
              style={{ color: "#A3B197" }}
            >
              {t("breathing.done.howDoYouFeel")}
            </p>

            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              {(
                [
                  {
                    id: "much_better" as PostMood,
                    labelKey: "breathing.postMood.much_better.label",
                    activeBg: "#1A3A1A",
                    activeBorder: "#3A6A3A",
                    activeColor: "#7AC47A",
                  },
                  {
                    id: "little_better" as PostMood,
                    labelKey: "breathing.postMood.little_better.label",
                    activeBg: "#1E2E1E",
                    activeBorder: "#3A4D3A",
                    activeColor: "#8FA680",
                  },
                  {
                    id: "same" as PostMood,
                    labelKey: "breathing.postMood.same.label",
                    activeBg: "#1A2228",
                    activeBorder: "#2A3038",
                    activeColor: "#6A8090",
                  },
                ] as const
              ).map((m) => {
                const active = postMood === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => void handleMoodSelect(m.id)}
                    className="h-11 rounded-xl text-sm font-medium transition-all duration-200"
                    style={{
                      background: active
                        ? m.activeBg
                        : "rgba(255,255,255,0.04)",
                      border: `1px solid ${
                        active ? m.activeBorder : "rgba(255,255,255,0.07)"
                      }`,
                      color: active ? m.activeColor : "#4A5A62",
                      transform: active ? "scale(1.02)" : "scale(1)",
                    }}
                  >
                    {t(m.labelKey)}
                  </button>
                );
              })}
            </div>

            {feedbackMsg && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 text-sm text-center px-6"
                style={{ color: "#8FA680", lineHeight: 1.65, maxWidth: 280 }}
              >
                {feedbackMsg}
              </motion.p>
            )}
            <button
              onClick={handleReturnToDashboard}
              className="mt-8 h-12 px-10 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-80"
              style={{
                background: "#1E2E2E",
                border: "1px solid #2D4040",
                color: "#C8D5B9",
              }}
              data-testid="button-breathing-return"
            >
              {t("breathing.done.return")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
