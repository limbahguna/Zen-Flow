import { useQuery } from "@tanstack/react-query";
import { getFearSetting } from "@/lib/fearSettings";
import { useAuth } from "@/hooks/useAuth";

export function useFearSetting(taskId: string, enabled: boolean) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: ["fear_settings", userId, taskId],
    queryFn: () => getFearSetting(userId, taskId),
    enabled: enabled && !!userId && !!taskId,
  });
}
