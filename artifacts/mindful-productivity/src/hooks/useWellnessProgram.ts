import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { abandonWellnessProgram, enrollWellnessProgram, getActiveEnrollment } from "@/lib/wellness/programEnrollments";
import { getWellnessPreferences, saveWellnessPreferences } from "@/lib/wellness/wellnessPreferences";
import type { ProgramSlug } from "@/lib/wellness/types";
import type { WellnessPreferencesInput } from "@/lib/wellness/types";

export const wellnessQueryKeys = {
  enrollment: (userId: string) => ["wellness-enrollment", userId] as const,
  preferences: (userId: string) => ["wellness-preferences", userId] as const,
};

export function useActiveWellnessEnrollment() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: wellnessQueryKeys.enrollment(userId ?? ""),
    queryFn: () => getActiveEnrollment(userId!),
    enabled: Boolean(userId),
  });
}

export function useWellnessPreferences() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: wellnessQueryKeys.preferences(userId ?? ""),
    queryFn: () => getWellnessPreferences(userId!),
    enabled: Boolean(userId),
  });
}

export function useSaveWellnessPreferences() {
  const { user } = useAuth();
  const client = useQueryClient();
  const userId = user?.id;
  return useMutation({
    mutationFn: (input: WellnessPreferencesInput) => {
      if (!userId) throw new Error("Authentication required");
      return saveWellnessPreferences(userId, input);
    },
    onSuccess: () => {
      if (userId) {
        void client.invalidateQueries({ queryKey: wellnessQueryKeys.preferences(userId) });
      }
    },
  });
}

export function useEnrollWellnessProgram() {
  const { user } = useAuth();
  const client = useQueryClient();
  const userId = user?.id;
  return useMutation({
    mutationFn: (programSlug: ProgramSlug) => enrollWellnessProgram(programSlug),
    onSuccess: () => {
      if (userId) {
        void client.invalidateQueries({ queryKey: wellnessQueryKeys.enrollment(userId) });
      }
    },
  });
}

export function useAbandonWellnessProgram() {
  const { user } = useAuth();
  const client = useQueryClient();
  const userId = user?.id;
  return useMutation({
    mutationFn: (enrollmentId: string) => abandonWellnessProgram(enrollmentId),
    onSuccess: () => {
      if (userId) {
        void client.invalidateQueries({ queryKey: wellnessQueryKeys.enrollment(userId) });
      }
    },
  });
}
