import { useQuery } from "@tanstack/react-query";
import { listTasks } from "@/lib/tasks";
import { useAuth } from "@/hooks/useAuth";

export function useTasks() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: ["tasks", userId],
    queryFn: () => listTasks(userId),
    enabled: !!userId,
  });
}
