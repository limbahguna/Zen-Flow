import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/context/LanguageContext";
import { useSaveSleepRoutineSession } from "@workspace/api-client-react";
import type { SleepRoutineSessionInputCompletedStepsItem } from "@workspace/api-client-react";
import { useSleepAuthRequest } from "@/hooks/useSleepAuthRequest";

// 15 deterministic stars
const STARS = [
  { t: 5,  l: 10, s: 2, d: 3.2, dl: 0.0 },
  { t: 12, l: 28, s: 2, d: 2.8, dl: 0.5 },
  { t: 7,  l: 45, s: 3, d: 3.5, dl: 1.2 },
  { t: 18, l: 62, s: 2, d: 2.4, dl: 0.8 },
  { t: 3,  l: 78, s: 2, d: 4.0, dl: 1.5 },
  { t: 22, l: 90, s: 2, d: 2.9, dl: 0.3 },
  { t: 15, l: 35, s: 2, d: 3.3, dl: 2.1 },
  { t: 9,  l: 55, s: 2, d: 2.6, dl: 1.0 },
  { t: 25, l: 18, s: 3, d: 3.7, dl: 0.6 },
  { t: 6,  l: 82, s: 2, d: 2.2, dl: 1.8 },
  { t: 30, l: 48, s: 2, d: 3.0, dl: 0.4 },
  { t: 4,  l: 65, s: 2, d: 3.6, dl: 2.5 },
  { t: 20, l: 8,  s: 2, d: 2.7, dl: 1.3 },
  { t: 35, l: 72, s: 2, d: 3.1, dl: 0.7 },
  { t: 10, l: 95, s: 3, d: 2.5, dl: 1.9 },
];

const SLEEP_PHASES = [
  { key: "inhale" as const, labelKey: "sleep.breathing.inhale", duration: 5,  toScale: 1.0 },
  { key: "hold"   as const, labelKey: "sleep.breathing.hold",   duration: 9,  toScale: 1.0 },
  { key: "exhale" as const, labelKey: "sleep.breathing.exhale", duration: 10, toScale: 0.6 },
] as const;
const SLEEP_ROUNDS = 3;
const TOTAL_SLEEP_PHASES = SLEEP_ROUNDS * SLEEP_PHASES.length;

type SleepPhase = "gratitude" | "release" | "breathing" | "goodnight";

export function SleepRoutineFlow({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [sleepPhase, setSleepPhase] = useState<SleepPhase>("gratitude");
  const [gratitudes, setGratitudes] = useState(["", "", ""]);
  const [release, setRelease] = useState("");
  const [releaseDissolving, setReleaseDissolving] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<SleepRoutineSessionInputCompletedStepsItem[]>([]);
  const { displayName } = useProfile();
  
  const { request } = useSleepAuthRequest();
  const saveRoutineSession = useSaveSleepRoutineSession({ request });

  // Breathing state
  const [breathPhaseIdx, setBreathPhaseIdx] = useState(0);
  const [breathSecondsLeft, setBreathSecondsLeft] = useState<number>(SLEEP_PHASES[0].duration);
  const [breathDone, setBreathDone] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);

  const userName    = displayName || t("sleep.goodnight.guestName");
  const canContinue = gratitudes.some(g => g.trim().length > 0);

  const currentBreathPhase = SLEEP_PHASES[breathPhaseIdx % SLEEP_PHASES.length];
  const currentBreathRound = Math.floor(breathPhaseIdx / SLEEP_PHASES.length);
  const isBreathHold        = currentBreathPhase.key === "hold";

  // ── Wake lock ────────────────────────────────────────────────────────────
  useEffect(() => {
    if ("wakeLock" in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).wakeLock.request("screen")
        .then((wl: unknown) => { wakeLockRef.current = wl; })
        .catch(() => {});
    }
    return () => { wakeLockRef.current?.release?.().catch(() => {}); };
  }, []);

  // ── Audio: start silently, fade in at breathing phase ───────────────────
  useEffect(() => {
    const a = new Audio("/audio/nature.mp3");
    a.loop = true;
    a.volume = 0;
    a.preload = "auto";
    audioRef.current = a;
    a.play().catch(() => {});

    return () => {
      if (audioRef.current) {
        let vol = audioRef.current.volume;
        const fade = setInterval(() => {
          vol -= 0.03;
          if (vol <= 0) {
            clearInterval(fade);
            if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
          } else if (audioRef.current) {
            audioRef.current.volume = vol;
          }
        }, 50);
      }
    };
  }, []);

  useEffect(() => {
    if (sleepPhase === "breathing" && audioRef.current) {
      let vol = audioRef.current.volume;
      const fade = setInterval(() => {
        vol += 0.01;
        if (vol >= 0.25) { vol = 0.25; clearInterval(fade); }
        if (audioRef.current) audioRef.current.volume = vol;
      }, 100);
    }
    if (sleepPhase === "goodnight" && audioRef.current) {
      const target = 0.12;
      let vol = audioRef.current.volume;
      if (vol > target) {
        const fade = setInterval(() => {
          vol -= 0.01;
          if (vol <= target) { clearInterval(fade); if (audioRef.current) audioRef.current.volume = target; }
          else if (audioRef.current) audioRef.current.volume = vol;
        }, 60);
      }
    }
  }, [sleepPhase]);

  // ── Breathing timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (sleepPhase !== "breathing" || breathDone) return;

    if (breathPhaseIdx >= TOTAL_SLEEP_PHASES) {
      setBreathDone(true);
      
      saveCompletedRoutine();
      return;
    }

    const dur = SLEEP_PHASES[breathPhaseIdx % SLEEP_PHASES.length].duration;
    setBreathSecondsLeft(dur);
    const iv = setInterval(() => setBreathSecondsLeft(s => (s <= 1 ? 0 : s - 1)), 1000);
    const to = setTimeout(() => setBreathPhaseIdx(i => i + 1), dur * 1000);
    return () => { clearInterval(iv); clearTimeout(to); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleepPhase, breathPhaseIdx, breathDone]);

  function handleReleaseContinue() {
    if (release.trim()) {
      setCompletedSteps((steps) => steps.includes("release") ? steps : [...steps, "release"]);
    }
    setReleaseDissolving(true);
    setTimeout(() => {
      setRelease("");
      setReleaseDissolving(false);
      setSleepPhase("breathing");
    }, 600);
  }

  function saveCompletedRoutine() {
    const sleepDate = new Date().toISOString().slice(0, 10);
    const steps: SleepRoutineSessionInputCompletedStepsItem[] = [
      ...completedSteps,
      "breathing",
      "goodnight",
    ];
    saveRoutineSession.mutate(
      { data: { sleepDate, completedSteps: Array.from(new Set(steps)) } },
      {
        onSuccess: () => {
          setTimeout(() => {
            setSleepPhase("goodnight");
            setTimeout(() => onClose(), 6000);
          }, 1000);
        },
      },
    );
  }

  const navBg =
    sleepPhase === "goodnight"
      ? "linear-gradient(180deg, #060810 0%, #0A0E18 100%)"
      : sleepPhase === "breathing"
      ? "linear-gradient(180deg, #0A0814 0%, #0F0F2E 50%, #121838 100%)"
      : "linear-gradient(180deg, #0A0E1A 0%, #0F1B3D 50%, #162040 100%)";

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none"
      style={{ background: navBg, transition: "background 1.2s ease" }}
      data-testid="sleep-routine-flow"
    >
      {/* Stars */}
      {STARS.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{ top: `${s.t}%`, left: `${s.l}%`, width: s.s, height: s.s }}
          animate={{ opacity: [0.1, 0.5, 0.1] }}
          transition={{ duration: s.d, repeat: Infinity, ease: "easeInOut", delay: s.dl }}
        />
      ))}

      {/* Crescent moon */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "6%", right: "12%",
          width: sleepPhase === "goodnight" ? 50 : 36,
          height: sleepPhase === "goodnight" ? 50 : 36,
          borderRadius: "50%",
          background: "#C8D5B9",
          boxShadow: "0 0 24px rgba(200,213,185,0.2), 0 0 60px rgba(200,213,185,0.07)",
          transition: "width 1.2s ease, height 1.2s ease",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute", top: -6, right: -12,
            width: sleepPhase === "goodnight" ? 44 : 32,
            height: sleepPhase === "goodnight" ? 44 : 32,
            borderRadius: "50%",
            background: navBg,
            transition: "width 1.2s ease, height 1.2s ease, background 1.2s ease",
          }}
        />
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label={t("sleep.close.ariaLabel")}
        style={{
          position: "absolute", top: 16, left: 16, zIndex: 60,
          background: "none", border: "none",
          color: "rgba(255,255,255,0.2)", fontSize: 24,
          cursor: "pointer", padding: "6px 10px",
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {/* ── Phase content ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* ── Phase 1: Gratitude ──────────────────────────────────────── */}
        {sleepPhase === "gratitude" && (
          <motion.div
            key="gratitude"
            className="absolute inset-0 flex flex-col items-center justify-center px-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 13, color: "rgba(200,213,185,0.6)",
              marginBottom: 10, letterSpacing: 1, textTransform: "uppercase",
            }}>
              {t("sleep.gratitude.eyebrow")}
            </p>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 22, color: "#E8EDE3",
              marginBottom: 8, textAlign: "center", lineHeight: 1.4,
            }}>
              {t("sleep.gratitude.title").split("\n").map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h2>
            <p style={{
              fontSize: 13, color: "rgba(200,213,185,0.45)",
              marginBottom: 0, textAlign: "center",
            }}>
              {t("sleep.gratitude.hint")}
            </p>

            <div style={{ marginTop: 24, width: "100%", maxWidth: 320 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}
                >
                  <span style={{
                    fontSize: 16, color: "#8FA680",
                    fontFamily: "'Playfair Display', serif", flexShrink: 0, width: 16,
                  }}>
                    {i + 1}.
                  </span>
                  <input
                    value={gratitudes[i]}
                    onChange={(e) => {
                      const g = [...gratitudes];
                      g[i] = e.target.value;
                      setGratitudes(g);
                    }}
                    placeholder={t(`sleep.gratitude.placeholder${i}` as any)}
                    style={{
                      flex: 1, padding: "12px 14px", borderRadius: 10,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(143,166,128,0.2)",
                      color: "#C8D5B9", fontSize: 14, outline: "none",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                if (canContinue) {
                  setCompletedSteps((steps) => steps.includes("gratitude") ? steps : [...steps, "gratitude"]);
                  setSleepPhase("release");
                }
              }}
              disabled={!canContinue}
              style={{
                marginTop: 24, padding: "13px 40px", borderRadius: 14,
                background: canContinue ? "rgba(143,166,128,0.2)" : "rgba(255,255,255,0.04)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${canContinue ? "rgba(143,166,128,0.35)" : "rgba(255,255,255,0.07)"}`,
                color: canContinue ? "#E8EDE3" : "rgba(200,213,185,0.25)",
                fontSize: 15, cursor: canContinue ? "pointer" : "not-allowed",
                transition: "all 500ms ease",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {t("sleep.gratitude.continue")}
            </button>
          </motion.div>
        )}

        {/* ── Phase 2: Release ────────────────────────────────────────── */}
        {sleepPhase === "release" && (
          <motion.div
            key="release"
            className="absolute inset-0 flex flex-col items-center justify-center px-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 26, color: "#E8EDE3",
              marginBottom: 12, textAlign: "center",
            }}>
              {t("sleep.release.title")}
            </h2>
            <p style={{
              fontSize: 14, color: "rgba(200,213,185,0.6)",
              lineHeight: 1.6, textAlign: "center", maxWidth: 300,
            }}>
              {t("sleep.release.body")}
            </p>

            <motion.div
              animate={releaseDissolving ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              style={{ width: "100%", maxWidth: 320 }}
            >
              <textarea
                value={release}
                onChange={(e) => setRelease(e.target.value)}
                placeholder={t("sleep.release.placeholder")}
                rows={4}
                style={{
                  width: "100%", padding: 14, borderRadius: 12,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(143,166,128,0.15)",
                  color: "#C8D5B9", fontSize: 14, lineHeight: 1.6,
                  resize: "none", outline: "none", marginTop: 20,
                  fontFamily: "'DM Sans', sans-serif",
                  boxSizing: "border-box",
                }}
              />
            </motion.div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 16 }}>
              <button
                onClick={handleReleaseContinue}
                style={{
                  padding: "13px 36px", borderRadius: 14,
                  background: "rgba(143,166,128,0.2)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(143,166,128,0.35)",
                  color: "#E8EDE3", fontSize: 15, cursor: "pointer",
                  transition: "all 500ms ease",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {t("sleep.release.continue")}
              </button>
              <button
                onClick={() => setSleepPhase("breathing")}
                style={{
                  background: "none", border: "none",
                  color: "rgba(200,213,185,0.4)", fontSize: 14,
                  cursor: "pointer", padding: "4px 16px",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {t("sleep.release.skip")}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Phase 3: Extended Breathing ─────────────────────────────── */}
        {sleepPhase === "breathing" && (
          <motion.div
            key="breathing"
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p style={{
              fontSize: 11, color: "rgba(200,213,185,0.45)",
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 28,
            }}>
              {t("sleep.breathing.label")}
            </p>

            <AnimatePresence mode="wait">
              <motion.p
                key={currentBreathPhase.key + currentBreathRound}
                style={{
                  fontSize: 18, color: "rgba(200,213,185,0.8)",
                  marginBottom: 24, fontFamily: "'Playfair Display', serif",
                }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {breathDone ? t("sleep.breathing.restWell") : t(currentBreathPhase.labelKey)}
              </motion.p>
            </AnimatePresence>

            {!breathDone && (
              <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
                <motion.div
                  key={`r2-${breathPhaseIdx}`}
                  className="absolute rounded-full pointer-events-none"
                  style={{ width: 210, height: 210, border: "1px solid rgba(147,130,200,0.07)" }}
                  animate={isBreathHold ? { scale: [0.95, 1.05, 0.95] } : { scale: currentBreathPhase.toScale * 1.15 }}
                  transition={isBreathHold
                    ? { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }
                    : { duration: currentBreathPhase.duration, ease: "easeInOut" }}
                />
                <motion.div
                  key={`r1-${breathPhaseIdx}`}
                  className="absolute rounded-full pointer-events-none"
                  style={{ width: 180, height: 180, border: "1px solid rgba(147,130,200,0.14)" }}
                  animate={isBreathHold ? { scale: [0.95, 1.05, 0.95] } : { scale: currentBreathPhase.toScale * 1.1 }}
                  transition={isBreathHold
                    ? { duration: 6, repeat: Infinity, ease: "easeInOut" }
                    : { duration: currentBreathPhase.duration, ease: "easeInOut" }}
                />
                <motion.div
                  key={`orb-${breathPhaseIdx}`}
                  className="absolute rounded-full"
                  style={{
                    width: 150, height: 150,
                    background: "radial-gradient(circle, rgba(147,130,200,0.6) 0%, rgba(100,80,160,0.2) 50%, transparent 70%)",
                  }}
                  animate={
                    isBreathHold
                      ? {
                          scale: [1.0, 1.03, 1.0],
                          boxShadow: [
                            "0 0 40px rgba(130,110,190,0.3), 0 0 80px rgba(130,110,190,0.08)",
                            "0 0 55px rgba(130,110,190,0.45), 0 0 110px rgba(130,110,190,0.15)",
                            "0 0 40px rgba(130,110,190,0.3), 0 0 80px rgba(130,110,190,0.08)",
                          ],
                        }
                      : currentBreathPhase.key === "inhale"
                      ? {
                          scale: currentBreathPhase.toScale,
                          boxShadow: [
                            "0 0 20px rgba(130,110,190,0.12)",
                            "0 0 60px rgba(130,110,190,0.4), 0 0 120px rgba(130,110,190,0.12)",
                          ],
                        }
                      : {
                          scale: currentBreathPhase.toScale,
                          boxShadow: [
                            "0 0 60px rgba(130,110,190,0.4), 0 0 120px rgba(130,110,190,0.12)",
                            "0 0 10px rgba(130,110,190,0.06)",
                          ],
                        }
                  }
                  transition={
                    isBreathHold
                      ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                      : { duration: currentBreathPhase.duration, ease: "easeInOut" }
                  }
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={breathSecondsLeft}
                        style={{ fontSize: 36, color: "rgba(255,255,255,0.85)", fontWeight: 700 }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {breathSecondsLeft}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-10">
              {Array.from({ length: SLEEP_ROUNDS }).map((_, i) => (
                <span
                  key={i}
                  className="rounded-full transition-all duration-500"
                  style={{
                    width: i === currentBreathRound && !breathDone ? 24 : 8,
                    height: 8,
                    background:
                      breathDone || i < currentBreathRound
                        ? "rgba(147,130,200,0.6)"
                        : i === currentBreathRound
                        ? "#9382C8"
                        : "rgba(147,130,200,0.2)",
                  }}
                />
              ))}
            </div>
            {breathDone && saveRoutineSession.isPending && (
              <p className="mt-6 text-sm text-[#C8B9D5]">{t("sleep.routine.saving")}</p>
            )}
            {breathDone && saveRoutineSession.isError && (
              <div className="mt-6 flex flex-col items-center gap-3" data-testid="sleep-routine-save-error">
                <p className="max-w-xs text-center text-sm text-[#D4806A]">{t("sleep.routine.saveError")}</p>
                <button
                  type="button"
                  onClick={saveCompletedRoutine}
                  className="rounded-xl border border-[#9382C8] px-5 py-2 text-sm text-[#E8EDE3]"
                  data-testid="sleep-routine-save-retry"
                >
                  {t("sleep.routine.retry")}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Phase 4: Good Night ─────────────────────────────────────── */}
        {sleepPhase === "goodnight" && (
          <motion.div
            key="goodnight"
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.5, delay: 0.4 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "0 32px" }}
            >
              <p style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 26, color: "#E8EDE3", textAlign: "center",
              }}>
                {t("sleep.goodnight.message").replace("{name}", userName)}
              </p>
              <p style={{
                fontSize: 14, color: "rgba(200,213,185,0.6)",
                textAlign: "center", maxWidth: 260, lineHeight: 1.7,
                fontStyle: "italic",
              }}>
                {t("sleep.goodnight.body")}
              </p>
              <div style={{ height: 40 }} />
              <p style={{
                fontSize: 12, color: "rgba(200,213,185,0.28)",
                letterSpacing: 1.5, textTransform: "uppercase",
              }}>
                {t("sleep.goodnight.seeYou")}
              </p>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
