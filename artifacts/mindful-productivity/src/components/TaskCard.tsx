import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles, Trophy, Mountain, Map, ChevronDown,
  Play, Check, CheckCircle2,
} from "lucide-react";
import type { TaskRow } from "@/lib/tasks";
import { useTaskActions } from "@/hooks/useTaskActions";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { AnxietyCheckModal } from "./AnxietyCheckModal";
import { FrictionReducerModal } from "./FrictionReducerModal";
import { FearSettingSection } from "./FearSettingSection";

function formatDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(lang, { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

const LEFT_BORDER: Record<string, string> = {
  pending:     "#D4B96A",
  in_progress: "#6AAFDB",
  done:        "#7AC47A",
  completed:   "#7AC47A",
  abandoned:   "#7A8A72",
};
const STATUS_STYLES: Record<string, string> = {
  pending:     "bg-[#3D3520] text-[#D4B96A]",
  in_progress: "bg-[#1E2A3D] text-[#6AAFDB]",
  done:        "bg-[#1E3020] text-[#7AC47A]",
  completed:   "bg-[#1E3020] text-[#7AC47A]",
  abandoned:   "bg-[#2D3A2E] text-[#7A8A72]",
};

// Intention step dots: which fields map to which step
const INTENTION_STEPS = [
  { key: "wish",         label: "W" },
  { key: "outcome",      label: "O" },
  { key: "obstacle",     label: "O" },
  { key: "plan_if_then", label: "P" },
] as const;

const CONFETTI_PARTICLES = [
  { id: 0,  dx: -80, color: "#8FA680", size: 7,  delay: 0.00 },
  { id: 1,  dx: -60, color: "#D4B96A", size: 6,  delay: 0.05 },
  { id: 2,  dx: -40, color: "#8FA680", size: 8,  delay: 0.10 },
  { id: 3,  dx: -20, color: "#D4B96A", size: 5,  delay: 0.02 },
  { id: 4,  dx:   0, color: "#7AC47A", size: 6,  delay: 0.08 },
  { id: 5,  dx:  20, color: "#8FA680", size: 7,  delay: 0.15 },
  { id: 6,  dx:  40, color: "#D4B96A", size: 5,  delay: 0.03 },
  { id: 7,  dx:  60, color: "#8FA680", size: 8,  delay: 0.12 },
  { id: 8,  dx:  80, color: "#D4B96A", size: 6,  delay: 0.07 },
  { id: 9,  dx: -70, color: "#7AC47A", size: 5,  delay: 0.18 },
  { id: 10, dx: -30, color: "#D4B96A", size: 7,  delay: 0.04 },
  { id: 11, dx:  10, color: "#8FA680", size: 6,  delay: 0.11 },
  { id: 12, dx:  50, color: "#7AC47A", size: 8,  delay: 0.16 },
  { id: 13, dx: -10, color: "#D4B96A", size: 5,  delay: 0.09 },
  { id: 14, dx:  30, color: "#8FA680", size: 7,  delay: 0.14 },
];

export function TaskCard({ task }: { task: TaskRow }) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { start, complete, postpone, abandon } = useTaskActions();
  const [open, setOpen] = useState(false);
  const [anxietyOpen, setAnxietyOpen] = useState(false);
  const [frictionOpen, setFrictionOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const status       = task.status;
  const isPending    = status === "pending";
  const isInProgress = status === "in_progress";
  const isDone       = status === "done" || status === "completed";
  const badge        = STATUS_STYLES[status] ?? "bg-[#2D3A2E] text-[#7A8A72]";

  // Localised status label
  const statusLabelKey = status === "in_progress" ? "task.status.in_progress" : `task.status.${status}`;
  const label = t(statusLabelKey) || status;

  const borderColor  = LEFT_BORDER[status] ?? "#2D3A2E";

  const postponeCount = task.postpone_count ?? 0;
  const isShrunk      = !!task.original_title && task.original_title !== task.title;
  const showActions   = isPending || isInProgress;

  // Intention completion dots
  const taskRecord   = task as unknown as Record<string, unknown>;
  const woopFilled   = INTENTION_STEPS.map(s => !!taskRecord[s.key]);
  const woopDone     = woopFilled.filter(Boolean).length;
  const isDashed     = postponeCount >= 3 && !isDone;

  function handleAnxietyStarted() {
    setAnxietyOpen(false);
    start.mutate(task.id, {
      onSuccess: () => toast({
        title: t("task.toast.start.title"),
        description: t("task.toast.start.desc").replace("{title}", task.title),
      }),
    });
  }

  async function handleComplete() {
    try {
      await complete.mutateAsync(task.id);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2200);
      toast({
        title: t("task.toast.complete.title"),
        description: t("task.toast.complete.desc"),
      });
    } catch {
      toast({ title: t("task.toast.error.title"), description: t("task.toast.error.desc"), variant: "destructive" });
    }
  }

  async function handlePostpone() {
    try {
      const count = await postpone.mutateAsync(task.id);
      if (count >= 3) { setFrictionOpen(true); }
      else {
        toast({
          title: t("task.toast.postponed.title"),
          description: count === 2
            ? t("task.toast.postponed.almostBreak")
            : t("task.toast.postponed.ready"),
        });
      }
    } catch {
      toast({ title: t("task.toast.error.title"), description: t("task.toast.error.desc"), variant: "destructive" });
    }
  }

  async function handleAbandon() {
    try {
      await abandon.mutateAsync(task.id);
      toast({ title: t("task.toast.abandon.title"), description: t("task.toast.abandon.desc") });
    } catch {
      toast({ title: t("task.toast.error.title"), description: t("task.toast.error.desc"), variant: "destructive" });
    }
  }

  function handleCoworkStarted() { start.mutate(task.id); }

  return (
    <div
      className="relative bg-[#222822] rounded-2xl overflow-hidden hover:border-[#3D4D35] transition-colors duration-200"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        border: isDashed
          ? `1.5px dashed ${borderColor}`
          : `1px solid #2D3A2E`,
        borderLeftWidth: isDashed ? "3px" : "3px",
        borderLeftColor: borderColor,
        borderLeftStyle: "solid",
      }}
      data-testid={`task-card-${task.id}`}
    >
      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            key="celebration"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            className="absolute inset-0 z-20 bg-[#1E3020]/95 rounded-2xl flex flex-col items-center justify-center gap-2 overflow-hidden"
            data-testid={`celebration-${task.id}`}
          >
            {CONFETTI_PARTICLES.map(p => (
              <motion.div
                key={p.id}
                style={{ position: "absolute", width: p.size, height: p.size, borderRadius: "50%", backgroundColor: p.color, left: "50%", bottom: "35%" }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: p.dx, y: -110 - Math.abs(p.dx) * 0.25, opacity: 0 }}
                transition={{ duration: 1.2, delay: p.delay, ease: "easeOut" }}
              />
            ))}
            <motion.div
              initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 18 }}
              className="w-16 h-16 rounded-full bg-[#2D4A2E] flex items-center justify-center"
            >
              <CheckCircle2 className="w-9 h-9 text-[#7AC47A]" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.25 }}
              className="text-center px-4"
            >
              <p className="font-heading font-bold text-lg text-[#7AC47A]">{t("task.celebration.title")}</p>
              <p className="text-xs text-[#A3B197] mt-1">{t("task.celebration.body")}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card header — tap to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left p-5 flex items-start justify-between gap-3"
        data-testid={`task-toggle-${task.id}`}
      >
        <div className="min-w-0 flex-1">
          {/* Top row: badge + date + postpone badge */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badge}`}>{label}</span>
            <span className="text-xs text-[#7A8A72]">{formatDate(task.created_at, language)}</span>
            {postponeCount > 0 && !isDone && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#3D3520] text-[#D4B96A]" data-testid={`postpone-badge-${task.id}`}>
                {t("task.postponedBadge").replace("{n}", String(postponeCount))}
              </span>
            )}
          </div>

          {/* Original title (if shrunk) */}
          {isShrunk && (
            <p className="text-sm text-[#7A8A72] line-through truncate" data-testid={`task-original-${task.id}`}>
              {task.original_title}
            </p>
          )}

          {/* Task title */}
          <h3 className="font-heading font-bold text-lg text-[#E8EDE3] truncate">{task.title}</h3>

          {/* Obstacle preview */}
          {task.obstacle && (
            <p className="text-xs italic text-[#7A8A72] mt-1 truncate" data-testid={`obstacle-preview-${task.id}`}>
              {t("task.obstacleLabel")}: {task.obstacle.length > 40 ? task.obstacle.slice(0, 40) + "…" : task.obstacle}
            </p>
          )}

          {/* Intention progress dots */}
          <div className="flex items-center gap-1.5 mt-2.5">
            {INTENTION_STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: woopFilled[i] ? borderColor : "#2D3A2E" }}
                  title={s.key}
                  data-testid={`woop-dot-${task.id}-${i}`}
                />
                {i < INTENTION_STEPS.length - 1 && (
                  <div className="w-2 h-px" style={{ backgroundColor: woopFilled[i] && woopFilled[i + 1] ? "#3D4D35" : "#2D3A2E" }} />
                )}
              </div>
            ))}
            <span className="text-xs text-[#7A8A72] ml-1">{woopDone}/4 {t("task.steps")}</span>
          </div>
        </div>

        <ChevronDown className={`w-5 h-5 text-[#7A8A72] shrink-0 mt-1 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Action buttons */}
      {showActions && (
        <div className="px-5 pb-4 -mt-1 space-y-2.5">
          <div className="flex items-center gap-1.5">
            {isPending ? (
              <>
                <motion.button
                  onClick={handleComplete}
                  disabled={complete.isPending}
                  className="flex-1 h-10 rounded-xl bg-[#1E3020] text-[#7AC47A] text-sm font-medium flex items-center justify-center gap-1 hover:bg-[#2A3D28] transition-all duration-300 disabled:opacity-60"
                  data-testid={`button-done-task-${task.id}`}
                  whileTap={{ scale: 0.97 }}
                >
                  <Check className="w-3.5 h-3.5" /> {t("task.action.done")}
                </motion.button>
                <motion.button
                  onClick={handlePostpone}
                  disabled={postpone.isPending}
                  className="h-10 px-3 rounded-xl text-sm font-medium text-[#D4B96A] bg-[#2D2A18] hover:bg-[#3D3520] transition-colors duration-300 disabled:opacity-60"
                  data-testid={`button-postpone-task-${task.id}`}
                  whileTap={{ scale: 0.97 }}
                >
                  {t("task.action.postpone")}
                </motion.button>
                <motion.button
                  onClick={handleAbandon}
                  disabled={abandon.isPending}
                  className="h-10 px-3 rounded-xl text-sm font-medium text-[#7A8A72] hover:bg-[#1E241E] hover:text-[#A3B197] border border-[#2D3A2E] transition-colors duration-300 disabled:opacity-60"
                  data-testid={`button-abandon-task-${task.id}`}
                  whileTap={{ scale: 0.97 }}
                >
                  {t("task.action.letItGo")}
                </motion.button>
              </>
            ) : (
              <>
                <motion.button
                  onClick={handleComplete}
                  disabled={complete.isPending}
                  className="flex-1 h-11 rounded-xl bg-[#1E3020] text-[#7AC47A] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#2A3D28] transition-all duration-300 disabled:opacity-60"
                  data-testid={`button-complete-task-${task.id}`}
                  whileTap={{ scale: 0.97 }}
                >
                  <Check className="w-4 h-4" /> {t("task.action.complete")}
                </motion.button>
                <motion.button
                  onClick={handlePostpone}
                  disabled={postpone.isPending}
                  className="h-11 px-4 rounded-xl text-sm font-medium text-[#7A8A72] hover:bg-[#1E241E] hover:text-[#A3B197] transition-colors duration-300 disabled:opacity-60"
                  data-testid={`button-postpone-task-${task.id}`}
                  whileTap={{ scale: 0.97 }}
                >
                  {t("task.action.postpone")}
                </motion.button>
              </>
            )}
          </div>
          {postponeCount === 2 && (
            <p className="text-xs text-[#D4B96A]" data-testid={`postpone-warning-${task.id}`}>
              {t("task.postponeWarning")}
            </p>
          )}
          {postponeCount >= 3 && (
            <button onClick={() => setFrictionOpen(true)} className="text-xs font-medium text-[#8FA680] hover:underline" data-testid={`button-break-down-${task.id}`}>
              {t("task.breakDown").replace("{n}", String(postponeCount))}
            </button>
          )}
        </div>
      )}

      {/* Done timestamp */}
      {isDone && task.completed_at && (
        <div className="px-5 pb-4 -mt-1">
          <p className="text-sm text-[#7AC47A] flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {t("task.completedOn").replace("{date}", formatDate(task.completed_at, language))}
          </p>
        </div>
      )}

      {/* Expandable intention detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 space-y-1 text-sm border-t border-[#2D3A2E]">
              {task.wish && (
                <WoopRow icon={<Sparkles className="w-4 h-4" style={{ color: "#8FA680" }} />} label={t("task.woop.wish")}     value={task.wish}           iconBg="#2D3A2E" />
              )}
              {task.outcome && (
                <WoopRow icon={<Trophy   className="w-4 h-4" style={{ color: "#7AC47A" }} />} label={t("task.woop.outcome")}  value={task.outcome}        iconBg="#1E3020" />
              )}
              {task.obstacle && (
                <WoopRow icon={<Mountain className="w-4 h-4" style={{ color: "#D4806A" }} />} label={t("task.woop.obstacle")} value={task.obstacle}       iconBg="#2D2420" />
              )}
              {task.plan_if_then && (
                <WoopRow icon={<Map      className="w-4 h-4" style={{ color: "#D4B96A" }} />} label={t("task.woop.plan")}     value={task.plan_if_then}  iconBg="#3D3520" />
              )}
              <div className="pt-2">
                <FearSettingSection taskId={task.id} enabled={open} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnxietyCheckModal
        task={anxietyOpen ? task : null}
        onClose={() => setAnxietyOpen(false)}
        onStarted={handleAnxietyStarted}
      />
      {frictionOpen && (
        <FrictionReducerModal task={task} onClose={() => setFrictionOpen(false)} onShrunk={() => setFrictionOpen(false)} onCoworkStarted={handleCoworkStarted} />
      )}
    </div>
  );
}

function WoopRow({ icon, label, value, iconBg }: { icon: React.ReactNode; label: string; value: string; iconBg: string; }) {
  return (
    <div className="flex gap-3 pt-3">
      <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ backgroundColor: iconBg }}>{icon}</div>
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-[#7A8A72]">{label}</span>
        <p className="text-[#C8D5B9] mt-0.5">{value}</p>
      </div>
    </div>
  );
}
