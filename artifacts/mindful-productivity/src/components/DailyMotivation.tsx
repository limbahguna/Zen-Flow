/**
 * DailyMotivation — card shown on the Home/Dashboard page.
 *
 * - Picks today's message deterministically from date string (no API calls).
 * - "Another" cycles through the library without persisting the override.
 * - Save/Favourite is persisted to localStorage.
 * - Share uses Web Share API with clipboard fallback.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Share2, RefreshCw, Sparkles } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  MOTIVATION_MESSAGES,
  dailyIndex,
  todayDateStr,
  getMessageByIndex,
  getFavourites,
  toggleFavourite,
} from "@/lib/motivationMessages";

export function DailyMotivation() {
  const { language, t } = useLanguage();

  const dateStr = todayDateStr();
  const baseIndex = dailyIndex(dateStr);

  const [overrideIndex, setOverrideIndex] = useState<number | null>(null);
  const [favourites, setFavourites] = useState<number[]>(() => getFavourites());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  const currentIndex = overrideIndex ?? baseIndex;
  const messageId = MOTIVATION_MESSAGES[currentIndex].id;
  const messageText = getMessageByIndex(currentIndex, language);
  const isFav = favourites.includes(messageId);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  };

  const handleSave = useCallback(() => {
    const nowFav = toggleFavourite(messageId);
    setFavourites(getFavourites());
    showToast(nowFav ? t("motivation.savedToast") : t("motivation.unsavedToast"));
  }, [messageId, t]);

  const handleShare = useCallback(async () => {
    const text = `${t("motivation.sharePrefix")}\n"${messageText}"`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // user cancelled or not supported — fall through
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } catch {}
  }, [messageText, t]);

  const handleAnother = useCallback(() => {
    // Pick a different index from the current one
    const next = ((currentIndex + 1) % MOTIVATION_MESSAGES.length);
    setOverrideIndex(next);
  }, [currentIndex]);

  return (
    <section
      data-testid="daily-motivation-card"
      className="relative bg-[#1E2A1E] rounded-2xl border border-[#2D3A2E] p-5 overflow-hidden"
    >
      {/* Subtle background accent */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top right, #C8D5B9 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-[#2D3A2E] flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-[#C8D5B9]" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7A8A72]">
          {t("motivation.title")}
        </span>
      </div>

      {/* Message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={currentIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="text-[15px] leading-relaxed text-[#D8E5CC] font-medium mb-5"
          data-testid="motivation-message"
        >
          "{messageText}"
        </motion.p>
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Save */}
        <button
          onClick={handleSave}
          data-testid="motivation-save"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors duration-200 ${
            isFav
              ? "bg-[#3D4D35] text-[#C8D5B9] border border-[#4D6040]"
              : "bg-[#2D3A2E] text-[#7A8A72] border border-[#2D3A2E] hover:text-[#C8D5B9]"
          }`}
          aria-label={isFav ? t("motivation.saved") : t("motivation.save")}
        >
          <Heart
            className="w-3.5 h-3.5"
            fill={isFav ? "currentColor" : "none"}
          />
          {isFav ? t("motivation.saved") : t("motivation.save")}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          data-testid="motivation-share"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#2D3A2E] text-[#7A8A72] border border-[#2D3A2E] hover:text-[#C8D5B9] transition-colors duration-200"
          aria-label={t("motivation.share")}
        >
          <Share2 className="w-3.5 h-3.5" />
          {shareStatus === "copied" ? t("motivation.copied") : t("motivation.share")}
        </button>

        {/* Another */}
        <button
          onClick={handleAnother}
          data-testid="motivation-another"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#2D3A2E] text-[#7A8A72] border border-[#2D3A2E] hover:text-[#C8D5B9] transition-colors duration-200 ml-auto"
          aria-label={t("motivation.another")}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t("motivation.another")}
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#3D4D35] text-[#C8D5B9] text-xs px-3 py-1.5 rounded-full pointer-events-none"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
