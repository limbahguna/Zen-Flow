import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Clock } from "lucide-react";
import { LessonReader } from "@/components/LessonReader";
import { useLessons } from "@/hooks/useLessons";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { CATEGORIES, categoryMeta, type LessonRow, type Category } from "@/lib/lessons";

const CATEGORY_GRADIENT: Record<Category, string> = {
  procrastination: "linear-gradient(135deg, #2D1A10 0%, #222822 80%)",
  anxiety:         "linear-gradient(135deg, #1A102D 0%, #222822 80%)",
  cbt:             "linear-gradient(135deg, #102214 0%, #222822 80%)",
  motivation:      "linear-gradient(135deg, #2D2010 0%, #222822 80%)",
  habits:          "linear-gradient(135deg, #10222D 0%, #222822 80%)",
};

const FILTERS = ["all", ...CATEGORIES] as const;

export default function LearnPage() {
  const { t, language } = useLanguage();
  const { data: lessons, isLoading, isFetching, isSuccess, isError, refetch } = useLessons();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [active, setActive] = useState<LessonRow | null>(null);

  // Reconcile an open lesson against the locale-specific catalog.
  // When the lesson query for the current language has settled (not loading/
  // fetching), match the open lesson by stable ID: replace it with the
  // current-language version if present, or close the reader if the ID is
  // absent (e.g. a remote English-only lesson after switching to ID/JA).
  // Guarded so we never reconcile/close prematurely while the query is in
  // flight, which would otherwise flash stale English content.
  useEffect(() => {
    if (!active) return;
    if (isLoading || isFetching || !isSuccess) return;
    const current = lessons?.find((l) => l.id === active.id);
    if (!current) {
      setActive(null);
    } else if (
      current.title !== active.title ||
      current.content !== active.content ||
      current.category !== active.category ||
      current.reading_time_minutes !== active.reading_time_minutes ||
      current.sort_order !== active.sort_order ||
      current.active !== active.active ||
      current.created_at !== active.created_at
    ) {
      setActive(current);
    }
    // `language` is included so reconciliation re-runs after a locale switch
    // once the new catalog has settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons, isLoading, isFetching, isSuccess, language, active?.id]);
  const { user } = useAuth();
  const userIdRef = useRef(user?.id ?? "");
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`read_lessons_${userIdRef.current}`);
      return new Set(stored ? (JSON.parse(stored) as string[]) : []);
    } catch { return new Set<string>(); }
  });

  function markRead(id: string) {
    setReadIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(`read_lessons_${user?.id ?? ""}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const totalCount = lessons?.length ?? 0;
  const readCount = useMemo(() => {
    if (!lessons) return 0;
    return lessons.filter(l => readIds.has(l.id)).length;
  }, [lessons, readIds]);

  const visible = useMemo(() => {
    if (!lessons) return [];
    if (filter === "all") return lessons;
    return lessons.filter((l) => l.category === filter);
  }, [lessons, filter]);

  return (
    <div className="bg-background">
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {FILTERS.map((f) => {
            const meta = f !== "all" ? categoryMeta(f) : null;
            const label = f === "all" ? t("learn.filter.all") : t(meta!.labelKey);
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                data-testid={`filter-${f}`}
                className={`shrink-0 px-4 h-9 rounded-full text-sm font-medium border transition-all duration-300 ${
                  isActive
                    ? "bg-[#4A5D3E] text-[#E8EDE3] border-[#4A5D3E]"
                    : "bg-[#1E241E] text-[#C8D5B9] border-[#2D3A2E] hover:border-[#8FA680]/40"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {totalCount > 0 && (
        <div className="max-w-4xl mx-auto px-4 pt-3 pb-1">
          <p style={{ fontSize: 13, color: "#A3B197", marginBottom: 6 }}>
            {readCount === totalCount
              ? t("learn.progress.allRead").replace("{count}", String(totalCount))
              : t("learn.progress.someRead")
                  .replace("{read}", String(readCount))
                  .replace("{total}", String(totalCount))}
          </p>
          <div style={{ height: 4, borderRadius: 999, background: "#2D3A2E", overflow: "hidden" }}>
            <div
              style={{
                height: "100%", borderRadius: 999, background: "#8FA680",
                width: `${totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0}%`,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 pt-5 space-y-3 pb-8">
        {isLoading ? (
          <div className="text-center py-12 text-[#7A8A72]">{t("learn.loading")}</div>
        ) : isError ? (
          <div className="text-center py-16 bg-[#222822] rounded-2xl border border-dashed border-[#2D3A2E]">
            <GraduationCap className="w-9 h-9 mx-auto mb-3 text-[#2D3A2E]" />
            <p className="font-heading font-bold text-lg text-[#E8EDE3]">{t("learn.error.title")}</p>
            <p className="text-[#A3B197] mt-1 mb-5">{t("learn.error.body")}</p>
            <button
              onClick={() => refetch()}
              className="h-11 px-5 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors duration-300"
              data-testid="button-lessons-retry"
            >
              {t("learn.error.retry")}
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 bg-[#222822] rounded-2xl border border-dashed border-[#2D3A2E]">
            <GraduationCap className="w-9 h-9 mx-auto mb-3 text-[#2D3A2E]" />
            <p className="font-heading font-bold text-lg text-[#E8EDE3]">{t("learn.empty.title")}</p>
            <p className="text-[#A3B197] mt-1">{t("learn.empty.body")}</p>
          </div>
        ) : (
          visible.map((lesson) => {
            const meta = categoryMeta(lesson.category);
            const Icon = meta.icon;
            const gradient = CATEGORY_GRADIENT[lesson.category as Category] ?? "linear-gradient(135deg, #222822 0%, #1E241E 100%)";
            return (
              <motion.button
                key={lesson.id}
                onClick={() => { setActive(lesson); markRead(lesson.id); }}
                data-testid={`lesson-card-${lesson.id}`}
                className="w-full text-left rounded-2xl border border-[#2D3A2E] p-4 flex items-center gap-3.5 hover:border-[#3D4D35] transition-all duration-300"
                style={{ background: gradient }}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <div
                  className="shrink-0 flex items-center justify-center rounded-xl"
                  style={{ width: 44, height: 44, backgroundColor: meta.iconBg }}
                >
                  <Icon className="w-5 h-5" style={{ color: meta.iconColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[#E8EDE3] leading-snug" style={{ fontSize: "14px" }}>
                    {lesson.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[#7A8A72] text-xs mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{t("learn.card.minRead").replace("{n}", String(lesson.reading_time_minutes))}</span>
                    <span aria-hidden>·</span>
                    <span>{t(meta.labelKey)}</span>
                  </div>
                </div>
                {readIds.has(lesson.id) ? (
                  <span style={{ color: "#7AC47A", fontSize: 17, flexShrink: 0, lineHeight: 1 }}>✓</span>
                ) : (
                  <span style={{
                    background: "#3D3520", color: "#D4B96A", fontSize: 10,
                    padding: "2px 7px", borderRadius: 999, flexShrink: 0, lineHeight: 1.5,
                  }}>{t("learn.card.new")}</span>
                )}
              </motion.button>
            );
          })
        )}
      </main>

      <AnimatePresence>
        {active && <LessonReader lesson={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </div>
  );
}
