import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  createIntention,
  listIntentions,
  updateIntention,
  updateIntentionStatus,
  type IntentionInput,
  type IntentionStatus,
} from "@/lib/intentions";

export function useIntentions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["intentions", user?.id],
    queryFn: listIntentions,
    enabled: !!user?.id,
  });
}

export function useIntentionActions() {
  const { user } = useAuth();
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: ["intentions", user?.id] });
  return {
    create: useMutation({ mutationFn: createIntention, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: IntentionInput }) =>
        updateIntention(id, input),
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: ({
        id,
        status,
        postponedUntil,
      }: {
        id: string;
        status: IntentionStatus;
        postponedUntil?: string | null;
      }) => updateIntentionStatus(id, status, postponedUntil),
      onSuccess: invalidate,
    }),
  };
}