import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import {
  getAuthenticatedUserId,
  requireSupabaseAuth,
} from "../middlewares/supabaseAuth";
import { logger } from "../lib/logger";

const router = Router();

export const PLAN_IDS = ["free", "plus", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PRICING_REGIONS = ["global", "indonesia", "japan"] as const;
export type PricingRegion = (typeof PRICING_REGIONS)[number];

const FEATURE_IDS = {
  free: [
    "limited_daily_exercises",
    "basic_mood_checkin",
    "limited_movement_mindfulness",
    "seven_day_history",
    "basic_ai_coach",
  ],
  plus: [
    "ai_messages_20",
    "full_mindfulness_library",
    "personalized_daily_routine",
    "weekly_progress_insights",
    "ninety_day_history",
    "premium_content",
    "basic_progress_report",
  ],
  pro: [
    "ai_messages_50",
    "all_plus_features",
    "advanced_personalized_coaching",
    "advanced_mood_habit_insights",
    "monthly_wellness_report",
    "unlimited_activity_history",
    "export_progress_report",
  ],
} as const satisfies Record<PlanId, readonly string[]>;

const PLAN_LIMITS: Record<PlanId, number> = {
  free: 5,
  plus: 20,
  pro: 50,
};

const PLAN_PRICES = {
  free: {
    global: { currency: "USD", amount: 0, display: "$0" },
    indonesia: { currency: "IDR", amount: 0, display: "Rp0" },
    japan: { currency: "JPY", amount: 0, display: "¥0" },
  },
  plus: {
    global: { currency: "USD", amount: 6.99, display: "$6.99" },
    indonesia: { currency: "IDR", amount: 69000, display: "Rp69.000" },
    japan: { currency: "JPY", amount: 980, display: "¥980" },
  },
  pro: {
    global: { currency: "USD", amount: 9.99, display: "$9.99" },
    indonesia: { currency: "IDR", amount: 99000, display: "Rp99.000" },
    japan: { currency: "JPY", amount: 1480, display: "¥1,480" },
  },
} as const satisfies Record<
  PlanId,
  Record<PricingRegion, { currency: string; amount: number; display: string }>
>;

export const PLAN_DEFINITIONS = PLAN_IDS.map((id) => ({
  id,
  dailyAiMessages: PLAN_LIMITS[id],
  featureIds: [...FEATURE_IDS[id]],
  prices: PLAN_PRICES[id],
}));

function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

function regionFromQuery(value: unknown): PricingRegion {
  if (value === "indonesia" || value === "japan") return value;
  return "global";
}

function bearerToken(authorization: string | undefined): string | null {
  const match = /^Bearer ([^\s]+)$/.exec(authorization ?? "");
  return match?.[1] ?? null;
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function userScopedClient(authorization: string | undefined) {
  const token = bearerToken(authorization);
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_ANON_KEY ?? "";
  if (!token || !url || !key) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

router.use("/subscription", requireSupabaseAuth);

router.get("/subscription", async (req, res) => {
  const userId = getAuthenticatedUserId(res);
  const region = regionFromQuery(req.query.region);
  const client = userScopedClient(req.headers.authorization);

  let activePlan: PlanId = "free";
  let usedToday = 0;

  if (client) {
    try {
      const entitlement = await client
        .from("user_entitlements")
        .select("plan")
        .eq("user_id", userId)
        .maybeSingle();

      if (!entitlement.error && isPlanId(entitlement.data?.plan)) {
        activePlan = entitlement.data.plan;
      } else if (entitlement.error) {
        logger.warn(
          { code: entitlement.error.code ?? "unknown" },
          "Subscription entitlement lookup failed; using Free defaults",
        );
      }

      const usage = await client
        .from("coach_usage")
        .select("count")
        .eq("user_id", userId)
        .eq("usage_date", utcDate())
        .maybeSingle();

      if (!usage.error && typeof usage.data?.count === "number") {
        usedToday = Math.max(0, usage.data.count);
      } else if (usage.error) {
        logger.warn(
          { code: usage.error.code ?? "unknown" },
          "Subscription usage lookup failed; using zero usage",
        );
      }
    } catch {
      logger.warn("Subscription storage is unavailable; using Free defaults");
    }
  }

  const dailyLimit = PLAN_LIMITS[activePlan];
  res.json({
    activePlan,
    dailyLimit,
    usedToday: Math.min(usedToday, dailyLimit),
    remainingToday: Math.max(0, dailyLimit - usedToday),
    selectedRegion: region,
    plans: PLAN_DEFINITIONS,
    billingAvailable: false,
  });
});

export default router;