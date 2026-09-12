import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, NotebookPen } from "lucide-react";
import { JournalEntryForm } from "@/components/JournalEntryForm";
import { useAuth } from "@/hooks/useAuth";
import { useJournal } from "@/hooks/useJournal";
import { useLanguage } from "@/context/LanguageContext";
import type { JournalEntryRow } from "@/lib/journal";

function formatDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(lang === "ja" ? "ja-JP" : lang === "id" ? "id-ID" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function JournalPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: entries, isLoading, isError, refetch } = useJournal();
  const [formOpen, setFormOpen] = useState(false);

  const totalEntries = entries?.length ?? 0;
  const avgImprovement = useMemo(() => {
    if (!entries || entries.length === 0) return 0;
    const valid = entries.filter(e => e.mood_before != null && e.mood_after != null);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, e) => acc + ((e.mood_after ?? 0) - (e.mood_before ?? 0)), 0);
    return Math.round((sum / valid.length) * 10) / 10;
  }, [entries]);

  const journalStreak = useMemo(() => {
    if (!entries || entries.length === 0) return 0;
    const days = new Set(entries.map(e => e.created_at.slice(0, 10)));
    let count = 0;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { count++; d.setDate(d.getDate() - 1); }
    return count;
  }, [entries]);

  useEffect(() => {
    const flag = localStorage.getItem("journal_open_new");
    if (flag === "1") {
      localStorage.removeItem("journal_open_new");
      setFormOpen(true);
    }
  }, []);

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["journal_entries", user?.id ?? ""] });
    setFormOpen(false);
  };

  return (
    <motion.div
      className="bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="max-w-4xl mx-auto px-4 pt-4 flex items-center justify-between">
        <p className="text-sm text-[#7A8A72]">{t("journal.subtitle")}</p>
        <button
          onClick={() => setFormOpen(true)}
          className="h-9 px-4 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium flex items-center gap-1.5 hover:bg-[#6B8C5A] transition-colors duration-300"
          data-testid="button-new-entry"
        >
          <Plus className="w-4 h-4" /> {t("journal.newEntry")}
        </button>
      </div>

      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-3 pb-8">
        {isLoading ? (
          <div className="text-center py-12 text-[#7A8A72]">{t("journal.loading")}</div>
        ) : isError ? (
          <div className="flex flex-col items-center text-center py-16 px-6">
            <div className="w-[120px] h-[120px] rounded-full bg-[#2D3A2E] flex items-center justify-center mb-6">
              <NotebookPen className="w-16 h-16 text-[#8FA680]" />
            </div>
            <p className="font-heading font-bold text-xl text-[#E8EDE3]">{t("journal.error.title")}</p>
            <p className="text-[#A3B197] mt-2 mb-7 max-w-xs leading-relaxed">
              {t("journal.error.body")}
            </p>
            <button
              onClick={() => refetch()}
              className="h-11 px-5 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors duration-300"
              data-testid="button-journal-retry"
            >
              {t("journal.error.retry")}
            </button>
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6" data-testid="journal-empty-state">
            <div className="w-[120px] h-[120px] rounded-full bg-[#2D3A2E] flex items-center justify-center mb-6">
              <NotebookPen className="w-16 h-16 text-[#8FA680]" />
            </div>
            <h2 className="font-heading font-bold text-xl text-[#E8EDE3]">{t("journal.empty.title")}</h2>
            <p className="text-[#A3B197] mt-2 mb-7 max-w-xs leading-relaxed">
              {t("journal.empty.body")}
            </p>
            <button
              onClick={() => setFormOpen(true)}
              className="h-11 px-6 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] text-sm font-medium hover:bg-[#6B8C5A] transition-colors duration-300 flex items-center gap-2"
              data-testid="button-write-first-entry"
            >
              <Plus className="w-4 h-4" /> {t("journal.empty.cta")}
            </button>
          </div>
        ) : (
          <>
            {totalEntries >= 3 && (
              <div
                data-testid="journal-insights-card"
                style={{
                  background: "#222822", borderRadius: 16, padding: 16,
                  border: "0.5px solid #2D3A2E", marginBottom: 4,
                }}
              >
                <p style={{ fontSize: 11, color: "#8FA680", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                  {t("journal.patterns.label")}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ fontSize: 14, color: "#C8D5B9" }}>
                    📝 {t("journal.patterns.entries").replace("{count}", String(totalEntries))}
                  </p>
                  <p style={{ fontSize: 14, color: "#C8D5B9" }}>
                    📈 {t("journal.patterns.avgShift")}{" "}
                    <span style={{ color: avgImprovement >= 0 ? "#7AC47A" : "#D4806A", fontWeight: 500 }}>
                      {avgImprovement >= 0 ? "+" : ""}{avgImprovement} {t("journal.patterns.points")}
                    </span>{" "}
                    {t("journal.patterns.afterReframe")}
                  </p>
                  <p style={{ fontSize: 14, color: "#C8D5B9" }}>
                    🔥 {t("journal.patterns.streak").replace("{count}", String(journalStreak))}
                  </p>
                </div>
              </div>
            )}
            {entries.map((entry) => (
              <JournalCard key={entry.id} entry={entry} language={language} t={t} />
            ))}
          </>
        )}
      </main>

      <AnimatePresence>
        {formOpen && (
          <JournalEntryForm onClose={() => setFormOpen(false)} onSaved={handleSaved} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function moodBorderColor(moodValue: number | null): string | null {
  if (moodValue == null) return null;
  if (moodValue <= 3) return "#D4806A";
  if (moodValue <= 5) return "#D4B96A";
  return "#7AC47A";
}

function JournalCard({ entry, language, t }: { entry: JournalEntryRow; language: string; t: (key: string) => string }) {
  const headline = entry.reframed_thought || entry.trigger_thought || t("journal.empty.title");
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const borderColor = moodBorderColor(entry.mood_after ?? entry.mood_before ?? null);

  return (
    <div
      className="bg-[#222822] rounded-2xl border border-[#2D3A2E] p-5"
      style={borderColor ? { borderLeft: `3px solid ${borderColor}` } : undefined}
      data-testid={`journal-card-${entry.id}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        {entry.mood_before != null && entry.mood_after != null ? (
          <div className="flex items-center gap-1">
            <span style={{ fontSize: 12, color: "#7A8A72" }}>{t("journal.card.mood")}</span>
            <span style={{ fontSize: 12, color: "#C8D5B9", fontWeight: 500 }}>{entry.mood_before}</span>
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: entry.mood_after > entry.mood_before ? "#7AC47A"
                   : entry.mood_after < entry.mood_before ? "#D4806A" : "#7A8A72",
            }}>
              {entry.mood_after > entry.mood_before ? " ↑ " : entry.mood_after < entry.mood_before ? " ↓ " : " → "}
            </span>
            <span style={{ fontSize: 12, color: "#C8D5B9", fontWeight: 500 }}>{entry.mood_after}</span>
          </div>
        ) : (
          <span />
        )}
        <span className="text-xs text-[#7A8A72]">{formatDate(entry.created_at, language)}</span>
      </div>
      <p className="text-[#C8D5B9] leading-snug">{headline}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-full bg-[#1E241E] border border-[#3D4D35] text-[#8FA680]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
