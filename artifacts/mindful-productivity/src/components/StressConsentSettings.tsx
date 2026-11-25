import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { saveJournalSentimentConsent } from "@/hooks/useStressCheck";

function storedConsent(): boolean {
  try {
    return localStorage.getItem("kindease_journal_sentiment_consent") === "1";
  } catch {
    return false;
  }
}

export function StressConsentSettings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [consent, setConsent] = useState(storedConsent);
  const [pending, setPending] = useState(false);

  async function onChange(next: boolean) {
    if (!user?.id) return;
    setConsent(next);
    setPending(true);
    try {
      await saveJournalSentimentConsent(user.id, next);
    } catch {
      // The local preference is still stored. The column update can wait for the migration.
    } finally {
      setPending(false);
    }
  }

  return (
    <label className="block rounded-2xl border border-[#2D3A2E] bg-[#1E241E] p-4 text-start" data-testid="stress-consent">
      <span className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[#8FA680]"
          checked={consent}
          disabled={pending || !user}
          onChange={(event) => void onChange(event.target.checked)}
          data-testid="stress-consent-toggle"
        />
        <span>
          <span className="block text-sm font-medium text-[#E8EDE3]">{t("stress.consent.label")}</span>
          <span className="mt-1 block text-xs text-[#7A8A72]">{t("stress.consent.hint")}</span>
        </span>
      </span>
    </label>
  );
}
