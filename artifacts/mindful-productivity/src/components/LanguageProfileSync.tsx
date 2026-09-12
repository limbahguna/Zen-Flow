import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { isSupportedLanguage } from "@/lib/translations";

/**
 * Existing profile metadata is authoritative for returning users. New users
 * keep the language selected before authentication until setup saves it.
 */
export function LanguageProfileSync() {
  const { user } = useAuth();
  const { setLanguage } = useLanguage();
  const hydratedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      hydratedUserId.current = null;
      return;
    }
    if (hydratedUserId.current === user.id) return;
    hydratedUserId.current = user.id;

    const profileLanguage = user.user_metadata?.language;
    if (isSupportedLanguage(profileLanguage)) {
      setLanguage(profileLanguage);
    }
  }, [setLanguage, user]);

  return null;
}