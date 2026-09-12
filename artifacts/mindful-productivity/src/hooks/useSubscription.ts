import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_PRICING_REGION,
  fetchSubscription,
  type PricingRegion,
} from "@/lib/subscription";

export function useSubscription(region: PricingRegion = DEFAULT_PRICING_REGION) {
  const { user, session } = useAuth();

  const query = useQuery({
    queryKey: ["subscription", user?.id ?? "", region],
    queryFn: () => fetchSubscription(session?.access_token ?? "", region),
    enabled: Boolean(user?.id && session?.access_token),
    staleTime: 60_000,
  });

  return { ...query, region };
}