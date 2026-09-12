import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";

export function useSleepAuthRequest() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const request = useMemo<RequestInit | undefined>(
    () =>
      accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : undefined,
    [accessToken],
  );

  return { request, enabled: Boolean(accessToken) };
}