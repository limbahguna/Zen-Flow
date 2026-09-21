import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, User as UserIcon, Send, RotateCcw, Info, X, Flag, Loader2 } from "lucide-react";
import { CrisisModal } from "@/components/CrisisModal";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { useAnxietyChecks } from "@/hooks/useAnxietyChecks";
import { useJournal } from "@/hooks/useJournal";
import { todayRatio } from "@/lib/insights";
import { useCoachContext, type CoachMessage as Message } from "@/context/CoachContext";
import { useLanguage } from "@/context/LanguageContext";
import type { LanguageCode } from "@/lib/translations";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { useLocation } from "wouter";
import { trackEvent } from "@/lib/analytics";
import { appApiUrl } from "@/lib/apiRuntime";

// AI calls go to the backend — no API key in the frontend.

const CRISIS_KEYWORDS = [
  "kill myself","suicide","suicidal","want to die","end my life",
  "self-harm","hurt myself","cutting myself","no reason to live","better off dead",
];
function hasCrisisKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw));
}

const REPORT_CATEGORIES = [
  "harmful_or_unsafe",
  "offensive_or_discriminatory",
  "incorrect_or_misleading",
  "other",
] as const;
type ReportCategory = (typeof REPORT_CATEGORIES)[number];

function readReportedMessageIds(userId: string): Set<string> {
  if (!userId) return new Set();
  try {
    const raw = sessionStorage.getItem(`mindful_ai_reported_${userId}`);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

// ── Build structured context for the backend (no system prompt string) ────────
// System prompt is assembled entirely server-side in aiCoach.ts.
// Frontend only sends structured data — backend sanitises it again.
// language is passed as a parameter so useMemo can react to changes.
function buildContext(
  language: LanguageCode,
  tasks: ReturnType<typeof useTasks>["data"],
  checks: ReturnType<typeof useAnxietyChecks>["data"],
  entries: ReturnType<typeof useJournal>["data"],
) {
  const at = tasks  ?? [];
  const ac = checks ?? [];
  const ae = entries ?? [];
  const ratio = todayRatio(at);
  return {
    language,
    tasks: at.slice(0, 10).map(tk => ({
      title:         tk.title,
      status:        tk.status,
      postponeCount: tk.postpone_count ?? 0,
    })),
    anxietyChecks: ac.slice(0, 5).map(c => ({
      feeling:   c.feeling,
      intensity: c.intensity,
      date:      new Date(c.created_at).toLocaleDateString(
        language === "ja" ? "ja-JP" : language === "id" ? "id-ID" : "en-US",
        { month: "short", day: "numeric" },
      ),
    })),
    journalEntries: ae.slice(0, 3).map(e => ({
      trigger: e.trigger_thought  ?? "",
      reframe: e.reframed_thought ?? "",
    })),
    todayCompleted: ratio.done,
    todayPlanned:   ratio.planned,
  };
}

export default function CoachPage() {
  const { user, session } = useAuth();
  const { data: tasks }   = useTasks();
  const { data: checks }  = useAnxietyChecks();
  const { data: entries } = useJournal();
  const { language, t }   = useLanguage();
  const [, setLocation] = useLocation();
  const { data: subscription } = useSubscription();

  const uid = user?.id ?? "";
  const { messages, setMessages } = useCoachContext();
  const { toast } = useToast();
  const [input,            setInput]            = useState("");
  const [typing,           setTyping]           = useState(false);
  // Null until the server returns the entitlement-aware quota.
  const [remaining,        setRemaining]        = useState<number | null>(null);
  const [error,            setError]            = useState<string | null>(null);
  const [crisisModal,      setCrisisModal]      = useState(false);
  const [disclaimerOpen,   setDisclaimerOpen]   = useState(false);
  const [coachKnowsDismissed, setCoachKnowsDismissed] = useState(() => {
    try { return !!localStorage.getItem(`coach_knows_dismissed_${uid}`); } catch { return false; }
  });
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [reportCategory, setReportCategory] = useState<ReportCategory | "">("");
  const [reportNote, setReportNote] = useState("");
  const [reportClientId, setReportClientId] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportedMessageIds, setReportedMessageIds] = useState<Set<string>>(
    () => readReportedMessageIds(uid),
  );

  const bottomRef = useRef<HTMLDivElement>(null);

  // language is in deps so context updates reactively if user changes language
  const userContext = useMemo(
    () => buildContext(language, tasks, checks, entries),
    [language, tasks, checks, entries],
  );

  // Translated suggestion prompts — send to AI in selected language
  const SUGGESTIONS = useMemo(() => [
    { emoji: "😰", text: t("coach.suggestion.postpone") },
    { emoji: "🧠", text: t("coach.suggestion.anxiety")  },
    { emoji: "⚡", text: t("coach.suggestion.productive") },
  ], [t]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  useEffect(() => {
    if (subscription) setRemaining(subscription.remainingToday);
  }, [subscription]);

  // Reset the in-session duplicate guard when the authenticated user changes.
  useEffect(() => {
    setReportedMessageIds(readReportedMessageIds(uid));
  }, [uid]);

  // Native buttons and radios provide keyboard support; Escape closes the modal.
  useEffect(() => {
    if (!reportTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !reportSubmitting) {
        setReportTarget(null);
        setReportCategory("");
        setReportNote("");
        setReportError(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [reportTarget, reportSubmitting]);

  function openReport(message: Message) {
    if (reportedMessageIds.has(message.id) || !message.reportToken) return;
    setReportTarget(message);
    setReportClientId(crypto.randomUUID());
    setReportCategory("");
    setReportNote("");
    setReportError(null);
  }

  async function submitReport() {
    if (
      !reportTarget ||
      !reportCategory ||
      !reportClientId ||
      !session?.access_token ||
      reportSubmitting
    ) return;
    setReportSubmitting(true);
    setReportError(null);

    try {
      const res = await fetch(appApiUrl("/api/ai/reports"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          category: reportCategory,
          optionalNote: reportNote || undefined,
          reportClientId,
          reportToken: reportTarget.reportToken,
        }),
      });

      if (!res.ok) {
        if (res.status === 409) throw new Error(t("coach.report.error.duplicate"));
        if (res.status === 429) throw new Error(t("coach.report.error.limit"));
        throw new Error(t("coach.report.error.generic"));
      }

      setReportedMessageIds((previous) => {
        const next = new Set(previous);
        next.add(reportTarget.id);
        try {
          sessionStorage.setItem(
            `mindful_ai_reported_${uid}`,
            JSON.stringify([...next]),
          );
        } catch {
          // Session storage is a convenience guard; the server remains authoritative.
        }
        return next;
      });
      setReportTarget(null);
      setReportClientId("");
      setReportCategory("");
      setReportNote("");
      toast({
        title: t("coach.report.success.title"),
        description: t("coach.report.success.desc"),
      });
    } catch (err) {
      setReportError(err instanceof Error ? err.message : t("coach.report.error.generic"));
    } finally {
      setReportSubmitting(false);
    }
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    if (!session?.access_token) { setError(t("coach.error.signin")); return; }
    if (remaining !== null && remaining <= 0) { setError(t("coach.error.limit")); return; }
    if (hasCrisisKeywords(trimmed)) { setCrisisModal(true); return; }

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history); setInput(""); setError(null); setTyping(true);

    try {
      const res = await fetch(appApiUrl("/api/ai/coach"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          // No systemPrompt — assembled server-side from userContext
          context: userContext,
          history: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.status === 429) {
        setError(t("coach.error.limit"));
        setRemaining(0);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as {
        reply: string;
        remaining: number;
        dailyLimit: number;
        plan: "free" | "plus" | "pro";
        reportToken?: string | null;
      };
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          reportToken: data.reportToken ?? undefined,
        },
      ]);
      // Sync quota from the entitlement-aware server response.
      setRemaining(data.remaining);
      trackEvent("coach_response_success", { plan: data.plan });
    } catch {
      setError(t("coach.error.generic"));
    } finally {
      setTyping(false);
    }
  }, [messages, remaining, typing, userContext, session, t]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); void sendMessage(input); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } };

  const quotaReached = remaining !== null && remaining <= 0;
  const isEmpty   = messages.length === 0;

  // counts for "Coach knows"
  const taskCount    = (tasks   ?? []).length;
  const checkCount   = (checks  ?? []).length;
  const entryCount   = (entries ?? []).length;
  const hasUserData  = taskCount + checkCount + entryCount > 0;

  // Build the "coach knows" description using locale-aware keys (no English plural fragments)
  const coachKnowsText = useMemo(() => {
    const parts: string[] = [];
    if (taskCount > 0)  parts.push(t("coach.knows.tasks").replace("{count}", String(taskCount)));
    if (checkCount > 0) parts.push(t("coach.knows.checks").replace("{count}", String(checkCount)));
    if (entryCount > 0) parts.push(t("coach.knows.entries").replace("{count}", String(entryCount)));
    if (parts.length === 0) return "";
    const dataList = parts.join(", ");
    return `${t("coach.knowsAnalysed")} ${dataList} ${t("coach.knowsEnd")}`;
  }, [taskCount, checkCount, entryCount, t]);

  function dismissCoachKnows() {
    try { localStorage.setItem(`coach_knows_dismissed_${uid}`, "1"); } catch {}
    setCoachKnowsDismissed(true);
  }

  return (
    <motion.div className="min-h-screen bg-background flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>

      {/* Header */}
      <header className="bg-[#141814]/90 backdrop-blur-md border-b border-[#2D3A2E] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">

          {/* Avatar with pulse */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2D3A2E 0%, #1E3020 100%)" }}>
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                <Bot className="w-6 h-6 text-[#8FA680]" />
              </motion.div>
            </div>
            {/* Online dot */}
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#7AC47A] border-2 border-[#141814]" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-heading font-bold text-sm text-[#E8EDE3] leading-none">{t("coach.title")}</p>
            <p className="text-xs text-[#7AC47A] mt-0.5 font-medium">● {t("coach.online")}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#7A8A72]">
              {remaining ?? "…"} {t("coach.remaining")}
            </span>
            <div className="relative">
              <button
                onClick={() => setDisclaimerOpen(v => !v)}
                className="w-8 h-8 rounded-lg bg-[#1E241E] flex items-center justify-center hover:bg-[#2D3A2E] transition-colors"
                data-testid="button-ai-disclaimer"
                aria-label={t("coach.disclaimer.title")}
              >
                <Info className="w-4 h-4 text-[#7A8A72]" />
              </button>
              <AnimatePresence>
                {disclaimerOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-[#222822] border border-[#2D3A2E] rounded-xl p-4 z-50 text-xs text-[#C8D5B9] leading-relaxed shadow-xl"
                    data-testid="ai-disclaimer-tooltip"
                  >
                    <p className="font-semibold text-[#E8EDE3] mb-1.5">{t("coach.disclaimer.title")}</p>
                    <p>{t("coach.disclaimer.body1")}</p>
                    <p className="mt-2">{t("coach.disclaimer.body2")}</p>
                    <button onClick={() => setDisclaimerOpen(false)} className="mt-3 text-[#8FA680] font-medium hover:underline">{t("coach.disclaimer.dismiss")}</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 pt-4 pb-36 overflow-y-auto">

        {/* Coach knows section */}
        {isEmpty && !coachKnowsDismissed && hasUserData && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl border border-[#2D3A2E] bg-[#1E241E] px-4 py-3 flex items-center gap-3"
            data-testid="coach-knows-banner"
          >
            <div className="w-8 h-8 rounded-xl bg-[#2D3A2E] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-[#8FA680]" />
            </div>
            <p className="flex-1 text-xs text-[#A3B197] leading-relaxed">
              {coachKnowsText}
            </p>
            <button onClick={dismissCoachKnows} className="text-[#7A8A72] hover:text-[#A3B197] shrink-0" aria-label={t("coach.knowsDismiss")}>
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center text-center pt-4 pb-10 gap-5" data-testid="coach-empty-state">
            <div
              className="w-[120px] h-[120px] rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #1A2A2E 0%, #0F1F22 100%)", border: "2px solid #243840" }}
            >
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}>
                <Bot className="w-14 h-14 text-[#5BB8B8]" />
              </motion.div>
            </div>
            <div>
              <p className="font-heading font-bold text-xl text-[#E8EDE3]">{t("coach.emptyTitle")}</p>
              <p className="text-[#A3B197] mt-2 max-w-xs leading-relaxed text-sm">
                {t("coach.emptySubtitle")}
              </p>
            </div>
            <div className="flex flex-col gap-2.5 w-full max-w-sm">
              {SUGGESTIONS.map(s => (
                <motion.button
                  key={s.text}
                  onClick={() => void sendMessage(s.text)}
                  whileTap={{ scale: 0.97 }}
                  className="w-full text-left px-4 py-3 rounded-2xl border border-[#2D3A2E] bg-[#1E241E] text-sm text-[#C8D5B9] hover:border-[#8FA680]/40 hover:bg-[#2D3A2E] hover:text-[#E8EDE3] transition-all duration-200 flex items-center gap-2.5"
                  data-testid={`suggestion-${s.text.slice(0,20).toLowerCase().replace(/\s+/g,"-")}`}
                >
                  <span className="text-lg">{s.emoji}</span>
                  <span>{s.text}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map(msg => (
          <motion.div
            key={msg.id}
            className={`flex gap-2.5 mb-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            data-testid={`message-${msg.role}`}
            initial={msg.role === "assistant" ? { opacity: 0, x: -16 } : { opacity: 0 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${msg.role === "assistant" ? "bg-[#2D3A2E]" : "bg-[#4A5D3E]"}`}>
              {msg.role === "assistant" ? <Bot className="w-4 h-4 text-[#8FA680]" /> : <UserIcon className="w-4 h-4 text-[#E8EDE3]" />}
            </div>
            <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-[#4A5D3E] text-[#E8EDE3] rounded-tr-sm" : "bg-[#222822] border border-[#2D3A2E] text-[#C8D5B9] rounded-tl-sm"}`}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {msg.content}
              </div>
              {msg.role === "assistant" && msg.reportToken && (
                <button
                  type="button"
                  onClick={() => openReport(msg)}
                  disabled={reportedMessageIds.has(msg.id)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs text-[#7A8A72] transition-colors hover:bg-[#222822] hover:text-[#C8D5B9] focus:outline-none focus:ring-2 focus:ring-[#8FA680]/60 disabled:cursor-default disabled:opacity-70"
                  aria-label={t("coach.report.button")}
                  data-testid={`report-button-${msg.id}`}
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                  {reportedMessageIds.has(msg.id)
                    ? t("coach.report.reported")
                    : t("coach.report.button")}
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {/* Typing indicator (breathing dots) */}
        {typing && (
          <div className="flex gap-2.5 mb-4" data-testid="typing-indicator">
            <div className="w-8 h-8 rounded-full bg-[#2D3A2E] flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-[#8FA680]" />
            </div>
            <div className="bg-[#222822] border border-[#2D3A2E] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0,1,2].map(i => (
                  <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-[#8FA680] block"
                    animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto mb-4 max-w-sm rounded-xl border border-[#4D3020] bg-[#2D2420] px-4 py-3 text-sm text-[#D4806A]" data-testid="coach-error">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 shrink-0" />{error}
            </div>
            {quotaReached && (
              <button
                type="button"
                onClick={() => setLocation("/plans")}
                className="mt-3 rounded-lg bg-[#4A5D3E] px-3 py-2 text-xs font-semibold text-[#E8EDE3] hover:bg-[#5A7050]"
                data-testid="coach-upgrade-link"
              >
                {t("coach.upgrade")}
              </button>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {reportTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coach-report-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reportSubmitting) setReportTarget(null);
          }}
          data-testid="coach-report-dialog"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="coach-report-title" className="font-heading text-lg font-bold text-[#E8EDE3]">
                  {t("coach.report.dialog.title")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[#A3B197]">
                  {t("coach.report.dialog.description")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                disabled={reportSubmitting}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#A3B197] hover:bg-[#2D3A2E] focus:outline-none focus:ring-2 focus:ring-[#8FA680]/60 disabled:opacity-50"
                aria-label={t("common.close")}
                data-testid="coach-report-close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold text-[#E8EDE3]">
                {t("coach.report.category.label")}
              </legend>
              {REPORT_CATEGORIES.map((category, index) => (
                <label
                  key={category}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#2D3A2E] px-3 text-sm text-[#C8D5B9] transition-colors hover:bg-[#222822] has-[:checked]:border-[#8FA680] has-[:checked]:bg-[#2D3A2E]"
                >
                  <input
                    type="radio"
                    name="report-category"
                    value={category}
                    checked={reportCategory === category}
                    onChange={() => setReportCategory(category)}
                    autoFocus={index === 0}
                    className="h-4 w-4 accent-[#8FA680] focus:ring-2 focus:ring-[#8FA680]/60"
                    data-testid={`report-category-${category}`}
                  />
                  {t(`coach.report.category.${category}`)}
                </label>
              ))}
            </fieldset>

            <div className="mt-4">
              <label htmlFor="coach-report-note" className="text-sm font-semibold text-[#E8EDE3]">
                {t("coach.report.note.label")}
              </label>
              <textarea
                id="coach-report-note"
                value={reportNote}
                onChange={(event) => setReportNote(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder={t("coach.report.note.placeholder")}
                className="mt-2 w-full resize-none rounded-xl border border-[#2D3A2E] bg-[#141814] px-3 py-2.5 text-sm text-[#E8EDE3] placeholder:text-[#7A8A72] focus:outline-none focus:ring-2 focus:ring-[#8FA680]/60"
                data-testid="coach-report-note"
              />
              <p className="mt-1 text-right text-xs text-[#7A8A72]" aria-live="polite">
                {reportNote.length}/500
              </p>
            </div>

            {reportError && (
              <p className="mt-3 rounded-lg bg-[#3D2020] px-3 py-2 text-sm text-[#D4806A]" role="alert" data-testid="coach-report-error">
                {reportError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                disabled={reportSubmitting}
                className="min-h-11 flex-1 rounded-xl border border-[#2D3A2E] px-4 text-sm font-medium text-[#A3B197] hover:bg-[#222822] focus:outline-none focus:ring-2 focus:ring-[#8FA680]/60 disabled:opacity-50"
                data-testid="coach-report-cancel"
              >
                {t("coach.report.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void submitReport()}
                disabled={!reportCategory || reportSubmitting}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#4A5D3E] px-4 text-sm font-semibold text-[#E8EDE3] hover:bg-[#6B8C5A] focus:outline-none focus:ring-2 focus:ring-[#8FA680]/60 disabled:cursor-not-allowed disabled:opacity-40"
                aria-busy={reportSubmitting}
                data-testid="coach-report-submit"
              >
                {reportSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {reportSubmitting ? t("coach.report.submitting") : t("coach.report.submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="fixed bottom-16 inset-x-0 z-20 bg-[#141814]/90 backdrop-blur-md border-t border-[#2D3A2E]">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-4 py-3 flex gap-2 items-end">
          <textarea
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            onContextMenu={(event) => {
              if (document.documentElement.classList.contains("capacitor-native")) {
                event.preventDefault();
              }
            }}
            placeholder={!quotaReached ? t("coach.placeholder") : t("coach.limitPlaceholder")}
            disabled={typing || quotaReached || !session?.access_token}
            rows={1}
            inputMode="text"
            className="coach-composer flex-1 resize-none rounded-xl border border-[#2D3A2E] bg-[#1A1E1A] px-4 py-2.5 text-sm text-[#C8D5B9] placeholder:text-[#7A8A72] focus:outline-none focus:ring-1 focus:ring-[#8FA680]/40 focus:border-[#8FA680]/40 transition-colors duration-200 disabled:opacity-50 max-h-32"
            style={{ lineHeight: "1.5" }}
            data-testid="coach-input"
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || typing || quotaReached || !session?.access_token}
            className="w-10 h-10 rounded-xl bg-[#4A5D3E] text-[#E8EDE3] flex items-center justify-center shrink-0 hover:bg-[#6B8C5A] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="coach-send"
            whileTap={{ scale: 0.94 }}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </form>
      </div>

      <AnimatePresence>{crisisModal && <CrisisModal onClose={() => setCrisisModal(false)} />}</AnimatePresence>
      <BottomNav />
    </motion.div>
  );
}
