import { useState } from "react";
import { Book } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useSaveSleepJournalEntry } from "@workspace/api-client-react";
import type { SleepSummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSleepAuthRequest } from "@/hooks/useSleepAuthRequest";

interface Props {
  summary: SleepSummary | undefined;
}

export function SleepJournalCard({ summary }: Props) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { request } = useSleepAuthRequest();
  const saveEntry = useSaveSleepJournalEntry({ request });
  
  const [content, setContent] = useState("");

  const recentEntries = summary?.recentJournalEntries || [];

  const handleSubmit = () => {
    if (!content.trim()) return;
    const sleepDate = new Date().toISOString().slice(0, 10);
    saveEntry.mutate(
      {
        data: {
          sleepDate,
          content: content.trim(),
        },
      },
      {
        onSuccess: (data) => {
          setContent("");
          queryClient.setQueryData(["/api/sleep"], (old: any) => {
            if (!old) return old;
            return {
              ...old,
              recentJournalEntries: [data, ...(old.recentJournalEntries || [])].slice(0, 5),
            };
          });
        },
      }
    );
  };

  const formatDate = (iso: string) => {
    try {
      const locale = language === "ja" ? "ja-JP" : language === "id" ? "id-ID" : "en-US";
      return new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="rounded-2xl border p-5 overflow-hidden"
      style={{
        background: "#121722",
        borderColor: "#232B3E",
      }}
      data-testid="sleep-journal-card"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#1C263A] text-[#A6B8D4] flex items-center justify-center">
          <Book className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-heading font-bold text-[#E8EDE3] text-lg leading-tight">
            {t("sleep.journal.title")}
          </h2>
          <p className="text-xs text-[#7A8A9E]">{t("sleep.journal.desc")}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("sleep.journal.placeholder")}
            rows={3}
            className="w-full p-3 rounded-xl text-sm resize-none focus:outline-none transition-colors"
            style={{
              background: "#0D111A",
              border: "1px solid #232B3E",
              color: "#E8EDE3",
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-[#D4806A]">
            {saveEntry.isError ? t("sleep.journal.error") : ""}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || saveEntry.isPending}
            className="px-5 py-2 rounded-xl text-sm font-medium transition-transform active:scale-[0.98]"
            style={{
              background: "#3A4B70",
              color: "#E8EDE3",
              opacity: !content.trim() || saveEntry.isPending ? 0.5 : 1,
            }}
          >
            {saveEntry.isPending ? t("sleep.journal.loading") : t("sleep.journal.submit")}
          </button>
        </div>

        {recentEntries.length > 0 ? (
          <div className="pt-4 border-t border-[#232B3E]">
            <p className="text-xs font-medium text-[#7A8A9E] mb-3 uppercase tracking-wider">
              {t("sleep.journal.recent")}
            </p>
            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="p-3 rounded-xl bg-[#0D111A] border border-[#1C263A]">
                  <p className="text-xs text-[#7A8A9E] mb-1">{formatDate(entry.createdAt)}</p>
                  <p className="text-sm text-[#C8D5B9] whitespace-pre-wrap">{entry.content}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-[#232B3E] text-center">
            <p className="text-sm text-[#7A8A9E] py-2">{t("sleep.journal.empty")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
