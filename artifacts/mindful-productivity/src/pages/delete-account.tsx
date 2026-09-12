import { useState } from "react";
import { ArrowLeft, Trash2, Shield, AlertTriangle, LogIn } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

// ── API base URL — same pattern as coach.tsx ──────────────────────────────────
const _rawBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_BASE = _rawBase ? _rawBase.replace(/\/$/, "") : "";

type DialogStep = null | "confirm1" | "confirm2" | "deleting" | "error";

/** Clears all Mindful Space localStorage data after account deletion. */
function clearLocalStorage() {
  try {
    localStorage.clear();
  } catch {
    // Best-effort; silently ignore in environments without localStorage access.
  }
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ background: "#2D3A2E", color: "#8FA680" }}
      >
        {number}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[#E8EDE3]">{title}</p>
        <div className="text-sm text-[#A3B197] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export default function DeleteAccountPage() {
  const { t, language } = useLanguage();
  const { user, session, signOut } = useAuth();
  const [, setLocation] = useLocation();

  const [dialogStep, setDialogStep] = useState<DialogStep>(null);
  const [confirmText, setConfirmText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // The expected confirmation word differs per locale
  const CONFIRM_WORD =
    language === "id" ? "HAPUS" : language === "ja" ? "DELETE" : "DELETE";

  async function handleDelete() {
    if (!session?.access_token) return;

    setDialogStep("deleting");
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        let msg = t("delete.confirm.error");
        try {
          const body = await res.json() as { error?: string };
          if (body.error) msg = body.error;
        } catch { /* ignore JSON parse errors */ }
        setErrorMsg(msg);
        setDialogStep("error");
        return;
      }

      // Success: sign out first (invalidates Supabase session tokens),
      // then clear Cache Storage (service-worker-cached user data),
      // then clear local storage, then redirect to auth
      await signOut();
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch {
        // Cache Storage unavailable in some environments — best effort only.
      }
      clearLocalStorage();
      setLocation("/auth");
    } catch {
      setErrorMsg(t("delete.confirm.error"));
      setDialogStep("error");
    }
  }

  function closeDialog() {
    setDialogStep(null);
    setConfirmText("");
    setErrorMsg(null);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-[#141814]/90 backdrop-blur-md border-b border-[#2D3A2E] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 -ml-2 rounded-lg hover:bg-[#1E241E] transition-colors"
            aria-label={t("delete.nav.back")}
            data-testid="delete-back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-[#A3B197]" />
          </button>
          <h1 className="font-heading font-bold text-base text-[#E8EDE3]">
            {t("delete.title")}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Intro */}
        <div
          className="flex items-start gap-4 p-5 rounded-2xl"
          style={{ background: "#222822", border: "0.5px solid #2D3A2E" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#3D2020" }}
          >
            <Trash2 className="w-5 h-5 text-[#D4806A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#E8EDE3] mb-1">
              {t("delete.intro.heading")}
            </p>
            <p className="text-sm text-[#A3B197] leading-relaxed">
              {t("delete.intro.body")}
            </p>
          </div>
        </div>

        {/* Developer info (required for Google Play) */}
        <div
          className="p-4 rounded-xl text-xs text-[#7A8A72] space-y-1"
          style={{ background: "#1A1E1A", border: "0.5px solid #2D3A2E" }}
          data-testid="delete-developer-info"
        >
          <p className="font-semibold text-[#A3B197]">Mindful Space</p>
          <p>Developer: Mindful Space Team</p>
          <p>
            Account deletion removes all your data. Backups are purged within
            90 days of deletion.
          </p>
        </div>

        {/* What gets deleted */}
        <section className="space-y-3">
          <h2 className="text-base font-heading font-bold text-[#E8EDE3]">
            {t("delete.section.what")}
          </h2>
          <div className="space-y-2 text-sm text-[#A3B197] leading-relaxed">
            {[
              t("delete.item.account"),
              t("delete.item.journal"),
              t("delete.item.intentions"),
              t("delete.item.anxiety"),
              t("delete.item.coach"),
              t("delete.item.settings"),
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D4806A] shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* ── Deletion action — authenticated vs guest ──────────────────────── */}
        {user ? (
          /* Authenticated: show the Danger Zone with direct deletion */
          <section
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid #5D2020" }}
            data-testid="delete-danger-zone"
          >
            <div
              className="px-5 py-4 flex items-center gap-3"
              style={{ background: "#2D1A1A" }}
            >
              <AlertTriangle className="w-5 h-5 text-[#D4806A] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#E8EDE3]">
                  {t("delete.dangerZone.title")}
                </p>
                <p className="text-xs text-[#A3796A] mt-0.5">
                  {t("delete.dangerZone.subtitle")}
                </p>
              </div>
            </div>
            <div className="px-5 py-4" style={{ background: "#221515" }}>
              <p className="text-xs text-[#7A8A72] mb-4">
                {user.email && (
                  <>
                    Signed in as <span className="text-[#A3B197]">{user.email}</span>
                  </>
                )}
              </p>
              <button
                onClick={() => setDialogStep("confirm1")}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "#3D2020",
                  color: "#D4806A",
                  border: "1px solid #5D3020",
                }}
                data-testid="btn-open-delete-dialog"
              >
                <Trash2 className="inline w-4 h-4 mr-2 -mt-0.5" />
                {t("delete.btn.deleteAccount")}
              </button>
            </div>
          </section>
        ) : (
          /* Guest: prompt to sign in */
          <section
            className="rounded-2xl p-5 space-y-4"
            style={{ background: "#222822", border: "0.5px solid #2D3A2E" }}
            data-testid="delete-guest-section"
          >
            <div className="flex items-center gap-3">
              <LogIn className="w-5 h-5 text-[#8FA680] shrink-0" />
              <p className="text-sm font-semibold text-[#E8EDE3]">
                {t("delete.public.guest.heading")}
              </p>
            </div>
            <p className="text-sm text-[#A3B197] leading-relaxed">
              {t("delete.public.guest.body")}
            </p>
            <button
              onClick={() => setLocation("/auth")}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "#2D3A2E",
                color: "#C8D5B9",
                border: "1px solid #3D5A3E",
              }}
              data-testid="btn-guest-sign-in"
            >
              {t("delete.public.guest.cta")}
            </button>
          </section>
        )}

        {/* Data retention note */}
        <div
          className="p-4 rounded-xl space-y-2"
          style={{ background: "#1A1E1A", border: "0.5px solid #2D3A2E" }}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#8FA680]" />
            <p className="text-xs font-semibold text-[#C8D5B9] uppercase tracking-wider">
              {t("delete.retention.label")}
            </p>
          </div>
          <p className="text-xs text-[#7A8A72] leading-relaxed">
            {t("delete.retention.body")}
          </p>
        </div>

        {/* Privacy policy link */}
        <p className="text-center text-xs text-[#7A8A72]">
          {t("delete.privacy.prefix")}{" "}
          <a
            href="/privacy"
            className="text-[#8FA680] underline underline-offset-2"
          >
            {t("delete.privacy.link")}
          </a>
        </p>

        <div className="h-8" />
      </main>

      {/* ── 2-step confirmation dialog ───────────────────────────────────────── */}
      {dialogStep !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          role="dialog"
          aria-modal="true"
          data-testid="delete-dialog"
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-5"
            style={{ background: "#1E241E", border: "1px solid #2D3A2E" }}
          >
            {/* Step 1 — warning */}
            {dialogStep === "confirm1" && (
              <>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#D4806A] shrink-0" />
                  <h2 className="font-heading font-bold text-[#E8EDE3]">
                    {t("delete.confirm.step1.title")}
                  </h2>
                </div>
                <p className="text-sm text-[#A3B197] leading-relaxed">
                  {t("delete.confirm.step1.body")}
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setDialogStep("confirm2")}
                    className="w-full py-3 rounded-xl text-sm font-semibold"
                    style={{
                      background: "#3D2020",
                      color: "#D4806A",
                      border: "1px solid #5D3020",
                    }}
                    data-testid="btn-confirm1-continue"
                  >
                    {t("delete.confirm.step1.cta")}
                  </button>
                  <button
                    onClick={closeDialog}
                    className="w-full py-3 rounded-xl text-sm font-medium text-[#7A8A72] hover:text-[#A3B197] transition-colors"
                    data-testid="btn-confirm1-cancel"
                  >
                    {t("delete.confirm.step1.cancel")}
                  </button>
                </div>
              </>
            )}

            {/* Step 2 — type DELETE */}
            {dialogStep === "confirm2" && (
              <>
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-[#D4806A] shrink-0" />
                  <h2 className="font-heading font-bold text-[#E8EDE3]">
                    {t("delete.confirm.step2.title")}
                  </h2>
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={t("delete.confirm.step2.placeholder")}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                  style={{
                    background: "#141814",
                    border: "1px solid #3D3020",
                    color: "#E8EDE3",
                    outline: "none",
                  }}
                  data-testid="input-confirm-delete"
                />
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDelete}
                    disabled={confirmText !== CONFIRM_WORD}
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: "#3D2020",
                      color: "#D4806A",
                      border: "1px solid #5D3020",
                    }}
                    data-testid="btn-confirm2-submit"
                  >
                    {t("delete.confirm.step2.cta")}
                  </button>
                  <button
                    onClick={closeDialog}
                    className="w-full py-3 rounded-xl text-sm font-medium text-[#7A8A72] hover:text-[#A3B197] transition-colors"
                    data-testid="btn-confirm2-cancel"
                  >
                    {t("delete.confirm.step2.cancel")}
                  </button>
                </div>
              </>
            )}

            {/* Deleting state */}
            {dialogStep === "deleting" && (
              <div className="text-center py-4 space-y-4">
                <div className="w-10 h-10 mx-auto rounded-full border-4 border-[#D4806A] border-t-transparent animate-spin" />
                <p className="text-sm text-[#A3B197]">
                  {t("delete.confirm.deleting")}
                </p>
              </div>
            )}

            {/* Error state */}
            {dialogStep === "error" && (
              <>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#D4806A] shrink-0" />
                  <h2 className="font-heading font-bold text-[#E8EDE3]">Error</h2>
                </div>
                <p className="text-sm text-[#A3B197] leading-relaxed">
                  {errorMsg ?? t("delete.confirm.error")}
                </p>
                <button
                  onClick={closeDialog}
                  className="w-full py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: "#222822",
                    color: "#C8D5B9",
                    border: "1px solid #2D3A2E",
                  }}
                  data-testid="btn-error-close"
                >
                  {t("delete.confirm.step1.cancel")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
