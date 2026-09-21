import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const THERAPEUTIC_QUOTES = [
  "You don't have to finish. You just have to start.",
  "A thought is not a fact. You can observe it without obeying it.",
  "Progress isn't linear. A hard day doesn't erase a good week.",
  "Rest is not giving up. It's how you prepare to keep going.",
  "The task feels enormous because you're seeing the whole mountain. Focus on the next step.",
  "Your anxiety is trying to protect you. Thank it, then decide if the threat is real.",
  "Done is better than perfect. Perfectionism is procrastination in disguise.",
  "You've survived 100% of your worst days. That's a perfect track record.",
  "Comparing your chapter 1 to someone else's chapter 20 isn't fair to either of you.",
  "Small steps still move you forward. Even 1% progress compounds over time.",
  "You are not your thoughts. You are the one who notices them.",
  "Courage isn't the absence of fear. It's starting despite the fear.",
  "The only productivity hack you need today: begin.",
  "Feelings are visitors. Let them come and go without building them a home.",
  "You don't need to feel ready. Readiness comes after starting.",
  "What would you tell a friend feeling this way? Now tell yourself the same thing.",
  "Anxiety whispers worst-case scenarios. Reality almost always whispers something kinder.",
  "Your brain is not broken. It's doing its best with what it has.",
  "One mindful breath can interrupt a spiral. You have that power right now.",
  "The gap between where you are and where you want to be is called growth.",
  "Procrastination isn't laziness. It's your brain avoiding discomfort. Name the discomfort.",
  "You don't have to earn rest. You don't have to earn peace. They're already yours.",
  "Today's only job: be 1% kinder to yourself than yesterday.",
  "The thoughts that scare you the most are usually the least true.",
  "Doing something imperfectly is infinitely better than doing nothing perfectly.",
  "Your worth is not measured by your productivity.",
  "Every expert was once a beginner who felt like giving up.",
  "Breathe. You're here. That's enough for right now.",
  "The most powerful words in CBT: 'Is this thought 100% true?'",
  "Tomorrow you'll be glad you started today. Even if today only lasts five minutes.",
];

const FOCUS_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
  "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800&q=80",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
];

const DURATIONS = [15, 25, 45];

function playCompletionSound() {
  try {
    const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* ignore */ }
}

export default function FocusPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [duration, setDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [label, setLabel] = useState("");
  const [muted, setMuted] = useState(false);
  const [liveCount, setLiveCount] = useState(() => 8 + Math.floor(Math.random() * 40));
  const [elapsedSecs, setElapsedSecs] = useState(0);

  const bgImage = useMemo(
    () => FOCUS_BACKGROUNDS[Math.floor(Math.random() * FOCUS_BACKGROUNDS.length)],
    [],
  );
  const completionQuote = useMemo(
    () => THERAPEUTIC_QUOTES[Math.floor(Date.now() / 86400000) % THERAPEUTIC_QUOTES.length],
    [],
  );

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number>(0);
  const liveRef     = useRef<number>(0);

  useEffect(() => {
    liveRef.current = window.setInterval(() => {
      setLiveCount(prev => Math.max(8, prev + Math.floor(Math.random() * 7) - 3));
    }, 30000);
    return () => clearInterval(liveRef.current);
  }, []);

  useEffect(() => {
    if (!running && !done) setTimeLeft(duration * 60);
  }, [duration, running, done]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setElapsedSecs(s => s + 1);
      setTimeLeft(tl => {
        if (tl <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          setDone(true);
          playCompletionSound();
          try {
            const prev = JSON.parse(localStorage.getItem("focus_sessions") ?? "[]");
            prev.push({ date: new Date().toISOString(), duration, label });
            localStorage.setItem("focus_sessions", JSON.stringify(prev));
          } catch { /* ignore */ }
          if (audioRef.current) {
            let vol = audioRef.current.volume;
            const fo = setInterval(() => {
              vol -= 0.04;
              if (vol <= 0) { clearInterval(fo); audioRef.current?.pause(); }
              else if (audioRef.current) audioRef.current.volume = vol;
            }, 50);
          }
          return 0;
        }
        return tl - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, duration, label]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(liveRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
    };
  }, []);

  function startAudio() {
    if (!audioRef.current) {
      const a = new Audio("/audio/nature.mp3");
      a.loop = true; a.volume = 0; a.preload = "auto";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a as any).playsInline = true;
      audioRef.current = a;
    }
    const a = audioRef.current!;
    a.muted = muted;
    const p = a.play();
    if (p) {
      p.then(() => {
        let vol = 0;
        const fi = setInterval(() => {
          vol += 0.02;
          if (vol >= 0.4) { vol = 0.4; clearInterval(fi); }
          if (a) a.volume = vol;
        }, 50);
      }).catch(() => {});
    }
  }

  function handleStart() { startAudio(); setRunning(true); }
  function handlePause() { setRunning(false); audioRef.current?.pause(); }
  function handleResume() {
    if (audioRef.current) audioRef.current.play().catch(() => {});
    setRunning(true);
  }
  function handleEnd() {
    clearInterval(intervalRef.current);
    setRunning(false); setDone(false); setElapsedSecs(0);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
    const fromDailyPlan = new URLSearchParams(window.location.search).get("from") === "daily-plan";
    setLocation(fromDailyPlan ? "/daily-plan" : "/dashboard");
  }
  function handleStartAnother() {
    setDone(false); setTimeLeft(duration * 60); setElapsedSecs(0); setRunning(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; audioRef.current = null; }
  }
  function toggleMute() {
    setMuted(m => {
      const next = !m;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }

  const totalSeconds = duration * 60;
  const progress = timeLeft === totalSeconds ? 0 : (totalSeconds - timeLeft) / totalSeconds;
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const isIdle = !running && timeLeft === duration * 60;
  const isPaused = !running && timeLeft < duration * 60 && !done;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");
  const sessionQuote = THERAPEUTIC_QUOTES[Math.floor(elapsedSecs / 300) % THERAPEUTIC_QUOTES.length];

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden select-none flex flex-col"
      style={{ backgroundImage: `url('${bgImage}')`, backgroundSize: "cover", backgroundPosition: "center" }}
      data-testid="focus-timer"
    >
      <div className="absolute inset-0" style={{ background: done ? "rgba(10,15,10,0.70)" : "rgba(10,15,10,0.55)" }} />

      <button onClick={handleEnd} type="button" aria-label={t("focus.close.ariaLabel")}
        style={{ position: "absolute", top: 20, left: 20, zIndex: 60, width: 44, height: 44,
          borderRadius: "50%", background: "rgba(0,0,0,0.35)", border: "none",
          color: "#C8D5B9", cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>
        <X size={18} />
      </button>

      <button onClick={toggleMute} type="button" aria-label={t("focus.mute.ariaLabel")}
        style={{ position: "absolute", top: 20, right: 20, zIndex: 60, width: 44, height: 44,
          borderRadius: "50%", background: "rgba(0,0,0,0.35)", border: "none",
          color: "#C8D5B9", fontSize: 20, cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>
        {muted ? "🔇" : "🔊"}
      </button>

      <div className="relative z-10 pt-20 text-center">
        <p style={{ fontSize: 13, color: "#C8D5B9", letterSpacing: 3,
          textTransform: "uppercase", fontFamily: "'Playfair Display', serif",
          textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
          {t("focus.session.title")}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!done ? (
          <motion.div key="timer"
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-6"
            style={{ gap: 24 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            {isIdle && (
              <input
                type="text" value={label} onChange={e => setLabel(e.target.value)}
                placeholder={t("focus.input.placeholder")}
                style={{
                  background: "rgba(0,0,0,0.2)", border: "1px solid rgba(143,166,128,0.3)",
                  borderRadius: 12, padding: "12px 16px", color: "#E8EDE3",
                  fontSize: 14, width: "100%", maxWidth: 300, outline: "none",
                  textAlign: "center", WebkitTapHighlightColor: "transparent",
                  caretColor: "#8FA680",
                }}
                className="placeholder:text-[#7A8A72]"
              />
            )}
            {label && !isIdle && (
              <p style={{ fontSize: 13, color: "rgba(200,213,185,0.7)", fontStyle: "italic" }}>"{label}"</p>
            )}

            <div style={{ position: "relative", width: 200, height: 200 }}>
              <svg width="200" height="200" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle
                  cx="100" cy="100" r={radius} fill="none"
                  stroke="#8FA680" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  style={{ transition: "stroke-dashoffset 0.8s linear" }}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 38,
                  fontWeight: 600, color: "#E8EDE3", letterSpacing: -1,
                  textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
                  {mins}:{secs}
                </span>
                {running && <span style={{ fontSize: 11, color: "rgba(163,177,151,0.7)", marginTop: 2 }}>{t("focus.timer.remaining")}</span>}
              </div>
            </div>

            {isIdle && (
              <div style={{ display: "flex", gap: 8 }}>
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => setDuration(d)} type="button"
                    style={{
                      padding: "10px 20px", borderRadius: 999, minHeight: 44,
                      background: duration === d ? "rgba(143,166,128,0.3)" : "rgba(0,0,0,0.2)",
                      color: duration === d ? "#C8D5B9" : "#7A8A72",
                      border: duration === d ? "1px solid rgba(143,166,128,0.5)" : "1px solid rgba(255,255,255,0.1)",
                      fontSize: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent",
                    }}>
                    {t("focus.duration.min").replace("{n}", String(d))}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%", maxWidth: 280 }}>
              {isIdle && (
                <button onClick={handleStart} type="button"
                  style={{ width: "100%", height: 52, borderRadius: 14,
                    background: "rgba(74,93,62,0.85)", color: "#E8EDE3", border: "none",
                    fontSize: 16, fontWeight: 500, backdropFilter: "blur(4px)",
                    cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  {t("focus.btn.start")}
                </button>
              )}
              {running && (
                <div style={{ display: "flex", gap: 10, width: "100%" }}>
                  <button onClick={handlePause} type="button"
                    style={{ flex: 1, height: 48, borderRadius: 12, background: "rgba(0,0,0,0.2)",
                      color: "#E8EDE3", border: "1px solid rgba(255,255,255,0.15)", fontSize: 15,
                      cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                    {t("focus.btn.pause")}
                  </button>
                  <button onClick={handleEnd} type="button"
                    style={{ flex: 1, height: 48, borderRadius: 12, background: "rgba(0,0,0,0.2)",
                      color: "#D4806A", border: "1px solid rgba(212,128,106,0.3)", fontSize: 15,
                      cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                    {t("focus.btn.end")}
                  </button>
                </div>
              )}
              {isPaused && (
                <div style={{ display: "flex", gap: 10, width: "100%" }}>
                  <button onClick={handleResume} type="button"
                    style={{ flex: 1, height: 48, borderRadius: 12, background: "rgba(74,93,62,0.85)",
                      color: "#E8EDE3", border: "none", fontSize: 15,
                      cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                    {t("focus.btn.resume")}
                  </button>
                  <button onClick={handleEnd} type="button"
                    style={{ flex: 1, height: 48, borderRadius: 12, background: "rgba(0,0,0,0.2)",
                      color: "#D4806A", border: "1px solid rgba(212,128,106,0.3)", fontSize: 15,
                      cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                    {t("focus.btn.end")}
                  </button>
                </div>
              )}
            </div>

            {running && (
              <div style={{ textAlign: "center" }}>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ fontSize: 12, color: "rgba(143,166,128,0.6)", marginBottom: 10 }}>
                  🟢 {t("focus.live.count").replace("{count}", String(liveCount))}
                </motion.p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={Math.floor(elapsedSecs / 300)}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.6 }}
                    style={{ fontStyle: "italic", fontSize: 13, color: "rgba(200,213,185,0.7)",
                      maxWidth: 280, margin: "0 auto", lineHeight: 1.5 }}>
                    "{sessionQuote}"
                  </motion.p>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="done"
            className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center"
            style={{ gap: 20 }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          >
            <div style={{ fontSize: 52, color: "#8FA680", textShadow: "0 0 24px rgba(143,166,128,0.5)", lineHeight: 1 }}>✓</div>
            <div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24,
                fontWeight: 700, color: "#E8EDE3", marginBottom: 8,
                textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
                {t("focus.done.title")}
              </h2>
              <p style={{ fontSize: 14, color: "#A3B197", lineHeight: 1.6 }}>
                {t("focus.duration.min").replace("{n}", String(duration))} · {label || t("focus.done.deepFocus")}
              </p>
            </div>
            <p style={{ fontStyle: "italic", fontSize: 13, color: "rgba(200,213,185,0.75)",
              maxWidth: 260, lineHeight: 1.6, margin: "0 auto" }}>
              "{completionQuote}"
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 280 }}>
              <button onClick={handleStartAnother} type="button"
                style={{ width: "100%", height: 52, borderRadius: 12,
                  background: "rgba(74,93,62,0.85)", color: "#E8EDE3", border: "none",
                  fontSize: 15, fontWeight: 600, backdropFilter: "blur(4px)",
                  cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                {t("focus.btn.startAnother")}
              </button>
              <button onClick={handleEnd} type="button"
                style={{ width: "100%", height: 52, borderRadius: 12, background: "rgba(0,0,0,0.2)",
                  color: "#A3B197", border: "1px solid rgba(255,255,255,0.1)", fontSize: 15,
                  cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                {t("focus.btn.done")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
