import { useQuery } from "@tanstack/react-query";
import { listJournalEntries } from "@/lib/journal";
import { useAuth } from "@/hooks/useAuth";

export function useJournal() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: ["journal_entries", userId],
    queryFn: () => listJournalEntries(userId),
    enabled: !!userId,
  });
}
