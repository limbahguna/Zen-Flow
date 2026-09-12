/**
 * MovementSession — full-screen modal with a 5-step guided movement session.
 *
 * Steps:
 *   1. Shoulder rolls     45s
 *   2. Neck stretch       45s
 *   3. Stand and walk    120s (2 min)
 *   4. Back stretch       45s
 *   5. Slow cooldown      45s
 *
 * Features: countdown timer, pause/resume, previous/next, completion tracking.
 * All text is localised through LanguageContext.
 *
 * Media: each step plays a looping MP4 video. Reduced motion and video errors
 * fall back to a static WebP image.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Pause, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { recordMovementCompletion, hasCompletedMovementToday } from "@/services/reminderService";
import { todayDateStr } from "@/lib/motivationMessages";
import { trackEvent } from "@/lib/analytics";

// ── Media mappings ─────────────────────────────────────────────────────────────

/** Looping MP4 videos — one per movement. */
const MOVEMENT_VIDEOS: Record<string, string> = {
  "shoulder-rolls": "/movements/shoulder-rolls-loop.mp4",
  "neck-stretch":   "/movements/neck-stretch-loop.mp4",
  "stand-walk":     "/movements/stand-and-walk-loop.mp4",
  "back-stretch":   "/movements/back-stretch-loop.mp4",
  "cooldown":       "/movements/slow-cooldown-loop.mp4",
};

/** Static WebP fallback images (reduced motion / video error). */
const MOVEMENT_IMAGES: Record<string, string> = {
  "shoulder-rolls": "/movements/shoulder-rolls.webp",
  "neck-stretch":   "/movements/neck-stretch.webp",
  "stand-walk":     "/movements/stand-and-walk.webp",
  "back-stretch":   "/movements/back-stretch.webp",
  "cooldown":       "/movements/slow-cooldown.webp",
};

const ALL_IMAGE_SRCS = Object.values(MOVEMENT_IMAGES);

interface Step {
  key: string;       // translation key suffix
  duration: number;  // seconds
  movementId: string; // key for MOVEMENT_VIDEOS / MOVEMENT_IMAGES
}

const STEPS: Step[] = [
  { key: "shoulder", duration: 45,  movementId: "shoulder-rolls" },
  { key: "neck",     duration: 45,  movementId: "neck-stretch"   },
  { key: "walk",     duration: 120, movementId: "stand-walk"     },
  { key: "back",     duration: 45,  movementId: "back-stretch"   },
  { key: "cooldown", duration: 45,  movementId: "cooldown"       },
];

interface MovementSessionProps {
  onClose: () => void;
  onComplete?: () => void;
}

function formatTime(seconds: number, secondsTemplate: string): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0
    ? `${m}:${String(s).padStart(2, "0")}`
    : secondsTemplate.replace("{n}", String(s));
}

export function MovementSession({ onClose, onComplete }: MovementSessionProps) {
  const { t } = useLanguage();
  const dateStr = todayDateStr();
  const alreadyDone = hasCompletedMovementToday(dateStr);
  const reducedMotion = useReducedMotion();

  const [stepIdx, setStepIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(STEPS[0].duration);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [completedOnce, setCompletedOnce] = useState(alreadyDone);
  const [videoError, setVideoError] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Preload fallback images so they display instantly if video errors
  useEffect(() => {
    ALL_IMAGE_SRCS.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Reset video error state whenever the active step changes
  useEffect(() => {
    setVideoError(false);
  }, [stepIdx]);

  // Sync video playback with session pause/resume state and step changes.
  // Runs after every step change (new video element mounted) and pause toggle.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Enforce muted programmatically for Android/iOS compatibility
    video.muted = true;
    if (paused) {
      video.pause();
    } else {
      video.play().catch(() => {
        // Autoplay may be blocked by the browser; the video stays paused visually
      });
    }
  }, [paused, stepIdx]);

  const currentStep = STEPS[stepIdx];

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimer = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          // Auto-advance or complete
          setStepIdx((si) => {
            if (si < STEPS.length - 1) {
              const next = si + 1;
              setTimeLeft(STEPS[next].duration);
              intervalRef.current = setInterval(() => {
                setTimeLeft((p) => {
                  if (p <= 1) {
                    clearTimer();
                    return 0;
                  }
                  return p - 1;
                });
              }, 1000);
              return next;
            } else {
              // Last step finished
              setDone(true);
              return si;
            }
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Start timer on mount (unless already done shown)
  useEffect(() => {
    if (!done) startTimer();
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-start timer when step changes via prev/next buttons
  const goTo = (idx: number) => {
    clearTimer();
    setStepIdx(idx);
    setTimeLeft(STEPS[idx].duration);
    setPaused(false);
    if (!done) startTimer();
  };

  const handlePauseResume = () => {
    if (paused) {
      setPaused(false);
      startTimer();
    } else {
      setPaused(true);
      clearTimer();
    }
  };

  const handleComplete = () => {
    clearTimer();
    videoRef.current?.pause();
    const recorded = recordMovementCompletion(dateStr);
    if (recorded) setCompletedOnce(true);
    trackEvent("movement_completed", { session: "guided_five_step" });
    setDone(true);
    onComplete?.();
  };

  const handleClose = () => {
    clearTimer();
    videoRef.current?.pause();
    onClose();
  };

  const progress = 1 - timeLeft / currentStep.duration;

  // ── Completed screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0F120F] flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <CheckCircle2 className="w-16 h-16 text-[#C8D5B9] mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-[#E8EDE3] mb-2">{t("movement.session.done")}</h2>
          <p className="text-[#7A8A72] text-sm mb-8">{t("movement.session.doneBody")}</p>
          <button
            onClick={handleClose}
            className="px-8 py-3 rounded-2xl bg-[#3D4D35] text-[#C8D5B9] text-sm font-semibold"
          >
            {t("movement.session.cancel")}
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Active session ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-[#0F120F] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-safe pt-5 pb-4 border-b border-[#1E2A1E]">
        <h2 className="text-base font-semibold text-[#E8EDE3]">
          {t("movement.session.title")}
        </h2>
        <button onClick={handleClose} aria-label={t("movement.session.cancel")}>
          <X className="w-5 h-5 text-[#7A8A72]" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-4 pb-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i < stepIdx
                ? "w-2 h-2 bg-[#C8D5B9]"
                : i === stepIdx
                ? "w-3 h-3 bg-[#C8D5B9]"
                : "w-2 h-2 bg-[#2D3A2E]"
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3">

        {/* Movement media — fade on step change only (key = stepIdx) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`media-${stepIdx}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-center"
          >
            {reducedMotion || videoError ? (
              /* Reduced motion or video error → static WebP fallback */
              <img
                src={MOVEMENT_IMAGES[currentStep.movementId]}
                alt={t(`movement.session.step.${currentStep.key}`)}
                aria-label={t(`movement.session.step.${currentStep.key}`)}
                role="img"
                className={`movement-img${paused ? " paused" : ""} object-contain w-[230px] h-[230px] md:w-[280px] md:h-[280px]`}
                style={{ objectFit: "contain" }}
                draggable={false}
                data-testid="movement-fallback-img"
              />
            ) : (
              /* Looping MP4 — only the active step is rendered */
              <video
                ref={videoRef}
                src={MOVEMENT_VIDEOS[currentStep.movementId]}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                aria-label={t(`movement.session.step.${currentStep.key}`)}
                className="object-contain w-[230px] h-[230px] md:w-[280px] md:h-[280px]"
                style={{ objectFit: "contain" }}
                draggable={false}
                onError={() => setVideoError(true)}
                data-testid="movement-video"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Step name + instruction */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`title-${stepIdx}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-center"
          >
            <h3 className="text-xl font-semibold text-[#E8EDE3]">
              {t(`movement.session.step.${currentStep.key}`)}
            </h3>
            {/* Short instruction */}
            <p className="text-sm text-[#7A8A72] mt-1 leading-snug">
              {t(`movement.session.instruction.${currentStep.key}`)}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Circular progress + timer */}
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#1E2A1E" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke="#C8D5B9" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-[#E8EDE3]" data-testid="movement-timer">
              {formatTime(timeLeft, t("movement.session.timer.seconds"))}
            </span>
          </div>
        </div>

        {/* Step counter */}
        <p className="text-xs text-[#7A8A72]">
          {stepIdx + 1} / {STEPS.length}
        </p>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 bg-[#1E2A1E] rounded-xl p-3 max-w-xs">
          <AlertCircle className="w-4 h-4 text-[#7A8A72] shrink-0 mt-0.5" />
          <p className="text-xs text-[#7A8A72] leading-relaxed">
            {t("movement.session.disclaimer")}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="px-5 pb-safe pb-6 space-y-3">
        {/* Prev / Pause / Next */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => stepIdx > 0 && goTo(stepIdx - 1)}
            disabled={stepIdx === 0}
            data-testid="movement-prev"
            className="w-12 h-12 rounded-2xl bg-[#222822] border border-[#2D3A2E] flex items-center justify-center disabled:opacity-30"
            aria-label={t("movement.session.prev")}
          >
            <ChevronLeft className="w-5 h-5 text-[#C8D5B9]" />
          </button>

          <button
            onClick={handlePauseResume}
            data-testid="movement-pause-resume"
            className="flex-1 h-12 rounded-2xl bg-[#3D4D35] text-[#C8D5B9] text-sm font-semibold flex items-center justify-center gap-2"
            aria-label={paused ? t("movement.session.resume") : t("movement.session.pause")}
          >
            {paused
              ? <><Play className="w-4 h-4" />{t("movement.session.resume")}</>
              : <><Pause className="w-4 h-4" />{t("movement.session.pause")}</>
            }
          </button>

          <button
            onClick={() => stepIdx < STEPS.length - 1 ? goTo(stepIdx + 1) : handleComplete()}
            data-testid="movement-next"
            className="w-12 h-12 rounded-2xl bg-[#222822] border border-[#2D3A2E] flex items-center justify-center"
            aria-label={stepIdx < STEPS.length - 1 ? t("movement.session.next") : t("movement.session.complete")}
          >
            <ChevronRight className="w-5 h-5 text-[#C8D5B9]" />
          </button>
        </div>

        {/* Complete session */}
        {stepIdx === STEPS.length - 1 && (
          <button
            onClick={handleComplete}
            data-testid="movement-complete"
            className="w-full h-12 rounded-2xl bg-[#C8D5B9] text-[#0F120F] text-sm font-bold"
          >
            {t("movement.session.complete")}
          </button>
        )}

        {/* Already done notice */}
        {completedOnce && (
          <p className="text-center text-xs text-[#7A8A72]">
            ✓ {t("movement.session.alreadyDone")}
          </p>
        )}
      </div>
    </div>
  );
}
