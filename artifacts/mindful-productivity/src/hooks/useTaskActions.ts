import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { startTask, completeTask, postponeTask, shrinkTask, abandonTask } from "@/lib/tasks";

export function useTaskActions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["tasks", user?.id ?? ""] });

  const start = useMutation({
    mutationFn: (taskId: string) => startTask(taskId),
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: (taskId: string) => completeTask(taskId),
    onSuccess: invalidate,
  });

  const postpone = useMutation({
    mutationFn: (taskId: string) => postponeTask(taskId),
    onSuccess: invalidate,
  });

  const shrink = useMutation({
    mutationFn: (vars: { taskId: string; newTitle: string; originalTitle: string }) =>
      shrinkTask(vars.taskId, vars.newTitle, vars.originalTitle),
    onSuccess: invalidate,
  });

  const abandon = useMutation({
    mutationFn: (taskId: string) => abandonTask(taskId),
    onSuccess: invalidate,
  });

  return { start, complete, postpone, shrink, abandon };
}
