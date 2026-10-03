import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

export function softLaunchNoticeKey(userId: string): string {
  return `soft_launch_notice_${userId}`;
}

export function SoftLaunchNotice({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId) return;
    try {
      if (!localStorage.getItem(softLaunchNoticeKey(userId))) setVisible(true);
    } catch {
      setVisible(false);
    }
  }, [userId]);

  function dismiss() {
    try {
      localStorage.setItem(softLaunchNoticeKey(userId), "1");
    } catch {
      // The notice is cosmetic. A storage failure just hides it for this view.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section
      className="rounded-2xl border border-[#2D3A2E] bg-[#1E241E] px-4 py-4"
      data-testid="soft-launch-notice"
    >
      <p className="text-sm leading-relaxed text-[#C8D5B9]">{t("softLaunch.notice")}</p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 rounded-lg bg-[#4A5D3E] px-3 py-2 text-xs font-semibold text-[#E8EDE3]"
        data-testid="soft-launch-dismiss"
      >
        {t("softLaunch.dismiss")}
      </button>
    </section>
  );
}
