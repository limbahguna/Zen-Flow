import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { HeartHandshake } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface DisclaimerBannerProps {
  userId: string;
  onDismissed?: () => void;
}

function storageKey(userId: string): string {
  return `mindful_disclaimer_dismissed_${userId}`;
}

export function DisclaimerBanner({ userId, onDismissed }: DisclaimerBannerProps) {
  const [visible, setVisible] = useState(false);
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    if (!userId) return;
    try {
      const dismissed = localStorage.getItem(storageKey(userId));
      if (!dismissed) setVisible(true);
    } catch {
      // localStorage not available — skip banner
    }
  }, [userId]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey(userId), "1");
    } catch {
      // ignore
    }
    setVisible(false);
    onDismissed?.();
  }

  function findHelp() {
    try {
      localStorage.setItem(storageKey(userId), "1");
    } catch {
      // ignore
    }
    setVisible(false);
    setLocation("/crisis");
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="disclaimer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
          data-testid="disclaimer-banner"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-md bg-[#222822] border border-[#2D3A2E] rounded-2xl p-6 space-y-4"
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-[#2D3A2E] flex items-center justify-center">
                <HeartHandshake className="w-7 h-7 text-[#8FA680]" />
              </div>
              <div>
                <p className="font-heading font-bold text-lg text-[#E8EDE3]">
                  {t("disclaimer.title")}
                </p>
                <p className="text-sm text-[#A3B197] mt-2 leading-relaxed">
                  {t("disclaimer.body1.prefix")}{" "}
                  <strong className="text-[#C8D5B9]">{t("disclaimer.body1.notSub")}</strong>{" "}
                  {t("disclaimer.body1.suffix")}
                </p>
                <p className="text-sm text-[#A3B197] mt-2 leading-relaxed">
                  {t("disclaimer.body2")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={dismiss}
                className="w-full h-11 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] font-medium text-sm hover:bg-[#6B8C5A] transition-colors"
                data-testid="button-disclaimer-understand"
              >
                {t("disclaimer.understand")}
              </button>
              <button
                onClick={findHelp}
                className="w-full h-11 rounded-xl border border-[#2D3A2E] text-[#A3B197] font-medium text-sm hover:bg-[#1E241E] transition-colors"
                data-testid="button-disclaimer-find-help"
              >
                {t("disclaimer.findHelp")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
