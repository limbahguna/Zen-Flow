import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getWeeklyReport, WeeklyReportData } from "@/lib/weeklyReport";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";

function getWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil((((now.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7);
}

function StatBox({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive: boolean;
}) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.18)",
        borderRadius: 12,
        padding: "10px 12px",
      }}
    >
      <p
        style={{
          fontSize: 10,
          color: "#7A8A72",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 17,
          fontWeight: 500,
          color: positive ? "#8FA680" : "#D4B96A",
          fontFamily: "'Playfair Display', serif",
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 10, color: "#7A8A72", marginTop: 2 }}>{sub}</p>
      )}
    </div>
  );
}

export default function WeeklyReportCard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const weekKey = `weekly_report_dismissed_${getWeekNumber()}`;
    try {
      if (localStorage.getItem(weekKey)) {
        setDismissed(true);
        setLoading(false);
        return;
      }
    } catch {}

    getWeeklyReport(user.id)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [user]);

  function dismiss() {
    try {
      localStorage.setItem(`weekly_report_dismissed_${getWeekNumber()}`, "true");
    } catch {}
    setDismissed(true);
  }

  if (loading || !report || !report.hasEnoughData || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35 }}
        data-testid="weekly-report-card"
        style={{
          background: "linear-gradient(135deg, #2D3A2E 0%, #1E2818 100%)",
          borderRadius: 20,
          padding: 20,
          border: "0.5px solid #3D4D35",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative glow */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(143,166,128,0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Dismiss button */}
        <button
          onClick={dismiss}
          aria-label={t("weekly.dismiss")}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 2,
            background: "rgba(0,0,0,0.2)",
            border: "none",
            borderRadius: "50%",
            width: 28,
            height: 28,
            color: "#7A8A72",
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          ✕
        </button>

        <div style={{ position: "relative", zIndex: 1 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#8FA680",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            {t("weekly.eyebrow")}
          </p>

          <h3
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 19,
              color: "#E8EDE3",
              marginBottom: 12,
              lineHeight: 1.35,
              paddingRight: 32,
            }}
          >
            {report.topInsight}
          </h3>

          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              style={{
                background: "rgba(143,166,128,0.15)",
                border: "1px solid rgba(143,166,128,0.3)",
                color: "#C8D5B9",
                borderRadius: 12,
                padding: "9px 18px",
                fontSize: 13,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {t("weekly.seeReport")}
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.25 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {report.moodChange !== null && (
                  <StatBox
                    label={t("weekly.stat.anxietyTrend")}
                    value={
                      report.moodChange > 0
                        ? `↓ ${report.moodChange.toFixed(1)}`
                        : report.moodChange < 0
                          ? `↑ ${Math.abs(report.moodChange).toFixed(1)}`
                          : t("weekly.stat.steady")
                    }
                    positive={report.moodChange >= 0}
                  />
                )}

                <StatBox
                  label={t("weekly.stat.intentions")}
                  value={`${report.intentionsCompleted}/${report.intentionsCreated}`}
                  sub={t("weekly.stat.completionRate").replace("{rate}", String(report.completionRate))}
                  positive={report.completionRate >= 40}
                />

                <StatBox
                  label={t("weekly.stat.journal")}
                  value={`${report.journalEntries}`}
                  sub={
                    report.avgMoodImprovement !== null
                      ? t("weekly.stat.moodShift").replace("{shift}", report.avgMoodImprovement.toFixed(1))
                      : undefined
                  }
                  positive={true}
                />

                <StatBox
                  label={t("weekly.stat.breathing")}
                  value={`${report.breathingSessions}`}
                  positive={true}
                />
              </div>

              <div
                style={{
                  background: "rgba(0,0,0,0.18)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18 }}>🔥</span>
                <p style={{ fontSize: 13, color: "#C8D5B9" }}>
                  <b style={{ color: "#E8EDE3" }}>
                    {t("weekly.streak").replace("{n}", String(report.currentStreak))}
                  </b>{" "}
                  {report.currentStreak >= 7
                    ? t("weekly.streakReal")
                    : t("weekly.streakKeep")}
                </p>
              </div>

              <button
                onClick={() => setExpanded(false)}
                style={{
                  marginTop: 10,
                  background: "none",
                  border: "none",
                  color: "#7A8A72",
                  fontSize: 12,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {t("weekly.showLess")}
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
