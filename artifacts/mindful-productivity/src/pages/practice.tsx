import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { useLanguage } from "@/context/LanguageContext";
import IntentionsPage from "./intentions";
import JournalPage from "./journal";
import LearnPage from "./learn";

type Tab = "intentions" | "journal" | "lessons";

export default function PracticePage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("intentions");

  const TABS: { id: Tab; labelKey: string }[] = [
    { id: "intentions", labelKey: "practice.tab.intentions" },
    { id: "journal",    labelKey: "practice.tab.journal"    },
    { id: "lessons",    labelKey: "practice.tab.lessons"    },
  ];

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "intentions" || requested === "journal" || requested === "lessons") {
      setActiveTab(requested);
      return;
    }
    const saved = localStorage.getItem("practice_tab") as Tab | null;
    if (saved === "journal" || saved === "lessons" || saved === "intentions") {
      setActiveTab(saved);
      localStorage.removeItem("practice_tab");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div
        style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "#1A1E1A",
          borderBottom: "0.5px solid #2D3A2E",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-0">
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 22, fontWeight: 600, color: "#E8EDE3", marginBottom: 2,
          }}>
            {t("practice.title")}
          </h1>
          <p style={{ fontSize: 13, color: "#7A8A72", marginBottom: 10 }}>
            {t("practice.subtitle")}
          </p>
        </div>

        <div className="max-w-4xl mx-auto flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`practice-tab-${tab.id}`}
              style={{
                flex: 1,
                padding: "10px 0 12px",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #8FA680" : "2px solid transparent",
                color: activeTab === tab.id ? "#C8D5B9" : "#7A8A72",
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 500 : 400,
                cursor: "pointer",
                transition: "all 200ms ease",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "intentions" && <IntentionsPage />}
          {activeTab === "journal"    && <JournalPage />}
          {activeTab === "lessons"    && <LearnPage />}
        </motion.div>
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
