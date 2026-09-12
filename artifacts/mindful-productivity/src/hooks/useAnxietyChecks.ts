import { useQuery } from "@tanstack/react-query";
import { listAnxietyChecks } from "@/lib/anxietyChecks";
import { useAuth } from "@/hooks/useAuth";

export function useAnxietyChecks() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: ["anxiety_checks", userId],
    queryFn: () => listAnxietyChecks(userId),
    enabled: !!userId,
  });
}
