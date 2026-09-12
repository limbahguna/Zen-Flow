import { motion } from "framer-motion";
import { Phone, HeartHandshake } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface CrisisModalProps {
  onClose: () => void;
}

function CrisisLine({ country, number }: { country: string; number: string }) {
  return (
    <a
      href={`tel:${number.replace(/[\s]/g, "")}`}
      className="flex items-center justify-between py-3 px-4 rounded-xl bg-[#1E3020] hover:bg-[#2A4030] transition-colors border border-[#2D3A2E]"
      data-testid={`crisis-line-${country.toLowerCase()}`}
    >
      <div>
        <p className="text-xs text-[#7AC47A]/70 font-medium uppercase tracking-wide">{country}</p>
        <p className="text-[#E8EDE3] font-bold text-lg tabular-nums">{number}</p>
      </div>
      <div className="w-9 h-9 rounded-full bg-[#2D3A2E] flex items-center justify-center">
        <Phone className="w-4 h-4 text-[#7AC47A]" />
      </div>
    </a>
  );
}

export function CrisisModal({ onClose }: CrisisModalProps) {
  const { t } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      data-testid="crisis-modal"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-sm bg-[#222822] border border-[#2D3A2E] rounded-2xl overflow-hidden"
      >
        <div className="p-6 space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#1E3020] flex items-center justify-center">
              <HeartHandshake className="w-7 h-7 text-[#7AC47A]" />
            </div>
            <div>
              <p className="font-heading font-bold text-xl text-[#E8EDE3]">{t("crisis.modal.title")}</p>
              <p className="text-sm text-[#A3B197] mt-2 leading-relaxed">
                {t("crisis.modal.body")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <CrisisLine country="USA" number="988" />
            <CrisisLine country="UK" number="116 123" />
            <CrisisLine country="Canada" number="988" />
            <CrisisLine country="Australia" number="13 11 14" />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <a
              href="tel:988"
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2 bg-[#1E3020] border border-[#2D3A2E] text-[#7AC47A] font-semibold text-sm hover:bg-[#2A4030] transition-colors"
              data-testid="button-crisis-call"
            >
              <Phone className="w-4 h-4" />
              {t("crisis.modal.callNow")}
            </a>
            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl border border-[#2D3A2E] text-[#A3B197] font-medium text-sm hover:bg-[#1E241E] transition-colors"
              data-testid="button-crisis-continue"
            >
              {t("crisis.modal.continue")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
