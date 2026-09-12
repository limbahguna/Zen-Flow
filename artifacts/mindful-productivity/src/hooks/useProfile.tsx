import { useCallback } from "react";
import { useAuth } from "./useAuth";
import supabase from "../lib/supabase";
import { isSupportedLanguage, type LanguageCode } from "@/lib/translations";

// Users created before this date already existed before the setup wizard
// was introduced — they are treated as profile-complete automatically.
const LEGACY_CUTOFF = new Date("2026-06-11T00:00:00Z");

export interface ProfileData {
  language?: LanguageCode;
  display_name: string;
  age_confirmed: boolean;
  primary_goal: string;
  procrastination_reasons: string[];
  initial_mood: string;
  profile_completed: boolean;
}

export function useProfile() {
  const { user, loading } = useAuth();

  const meta = user?.user_metadata ?? {};

  const isLegacyUser = user?.created_at
    ? new Date(user.created_at) < LEGACY_CUTOFF
    : false;

  const isProfileComplete: boolean =
    meta.profile_completed === true || isLegacyUser;

  // Prefer saved display_name, then Google full_name / name, then email prefix.
  // Use || (not ??) so empty strings fall through to the next option.
  const displayName: string =
    meta.display_name ||
    meta.full_name ||
    meta.name ||
    (user?.email ? user.email.split("@")[0] : "");

  const profile: ProfileData | null = user
    ? {
        language: isSupportedLanguage(meta.language) ? meta.language : undefined,
        display_name: displayName,
        age_confirmed: meta.age_confirmed ?? false,
        primary_goal: meta.primary_goal ?? "",
        procrastination_reasons: meta.procrastination_reasons ?? [],
        initial_mood: meta.initial_mood ?? "",
        profile_completed: isProfileComplete,
      }
    : null;

  const updateProfile = useCallback(
    async (data: Partial<ProfileData>) => {
      await supabase.auth.updateUser({ data: data as Record<string, unknown> });
    },
    [],
  );

  return {
    profile,
    profileLoading: loading,
    isProfileComplete,
    displayName,
    updateProfile,
  };
}
