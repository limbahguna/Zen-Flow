import { appApiUrl } from "./apiRuntime";

export type PlanId = "free" | "plus" | "pro";
export type PricingRegion = "global" | "indonesia" | "japan";
export const DEFAULT_PRICING_REGION: PricingRegion = "global";

const INDONESIA_TIMEZONES = new Set([
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
]);

function deviceLocale(): string | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.language;
}

function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function pricingRegionForDevice(
  locale: string | undefined = deviceLocale(),
  timeZone: string | undefined = deviceTimeZone(),
): PricingRegion {
  if (INDONESIA_TIMEZONES.has(timeZone ?? "")) {
    return "indonesia";
  }
  if (timeZone === "Asia/Tokyo") {
    return "japan";
  }

  const normalizedLocale = locale?.trim().toLowerCase().replace(/_/g, "-");
  const localeParts = normalizedLocale?.split("-") ?? [];
  const language = localeParts[0];
  const country = localeParts.at(-1);
  if (language === "id" || country === "id") return "indonesia";
  if (language === "ja" || country === "jp") return "japan";

  return DEFAULT_PRICING_REGION;
}

export interface SubscriptionPrice {
  currency: string;
  amount: number;
  display: string;
}

export interface SubscriptionPlan {
  id: PlanId;
  dailyAiMessages: number;
  featureIds: string[];
  prices: Record<PricingRegion, SubscriptionPrice>;
}

export interface SubscriptionStatus {
  activePlan: PlanId;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  selectedRegion: PricingRegion;
  plans: SubscriptionPlan[];
  billingAvailable: boolean;
}

export async function fetchSubscription(
  accessToken: string,
  region: PricingRegion,
): Promise<SubscriptionStatus> {
  const response = await fetch(
    appApiUrl(`/api/subscription?region=${encodeURIComponent(region)}`),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Subscription request failed (${response.status})`);
  }
  return (await response.json()) as SubscriptionStatus;
}