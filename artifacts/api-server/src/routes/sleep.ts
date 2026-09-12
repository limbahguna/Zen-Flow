import { Router, type Request, type Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId, requireSupabaseAuth } from "../middlewares/supabaseAuth";
import { logger } from "../lib/logger";

const router = Router();

const FEELINGS = ["rested", "okay", "tired", "restless"] as const;
const ROUTINE_STEPS = ["digital_sunset", "gratitude", "release", "breathing", "goodnight"] as const;
const PLAN_RANK = { free: 0, plus: 1, pro: 2 } as const;
type PlanId = keyof typeof PLAN_RANK;
type Feeling = (typeof FEELINGS)[number];
type RoutineStep = (typeof ROUTINE_STEPS)[number];

interface SleepCheckInRecord {
  id: string;
  user_id: string;
  sleep_date: string;
  sleep_quality: number;
  energy_level: number;
  feeling: Feeling;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SleepJournalRecord {
  id: string;
  user_id: string;
  sleep_date: string;
  content: string;
  created_at: string;
}

interface SleepRoutineRecord {
  id: string;
  user_id: string;
  sleep_date: string;
  completed_steps: RoutineStep[];
  completed_at: string;
}

function bearerToken(authorization: string | undefined): string | null {
  const match = /^Bearer ([^\s]+)$/.exec(authorization ?? "");
  return match?.[1] ?? null;
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

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorCode(error: unknown): string {
  return isRecord(error) && typeof error.code === "string" ? error.code : "unknown";
}

function mapCheckIn(row: SleepCheckInRecord) {
  return {
    id: row.id,
    userId: row.user_id,
    sleepDate: row.sleep_date,
    sleepQuality: row.sleep_quality,
    energyLevel: row.energy_level,
    feeling: row.feeling,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJournal(row: SleepJournalRecord) {
  return {
    id: row.id,
    userId: row.user_id,
    sleepDate: row.sleep_date,
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapRoutine(row: SleepRoutineRecord) {
  return {
    id: row.id,
    userId: row.user_id,
    sleepDate: row.sleep_date,
    completedSteps: row.completed_steps ?? [],
    completedAt: row.completed_at,
  };
}

async function activePlan(client: SupabaseClient, userId: string): Promise<PlanId> {
  const { data, error } = await client
    .from("user_entitlements")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    logger.warn({ code: errorCode(error) }, "Sleep entitlement lookup failed; using Free defaults");
    return "free";
  }
  const plan = (data as { plan?: unknown } | null)?.plan;
  return plan === "plus" || plan === "pro" ? plan : "free";
}

async function sleepStorage(req: Request, res: Response): Promise<SupabaseClient | null> {
  const client = userScopedClient(req.headers.authorization);
  if (!client) {
    res.status(503).json({ error: "Sleep storage is not available" });
    return null;
  }
  return client;
}

router.use("/sleep", requireSupabaseAuth);

router.get("/sleep", async (req, res) => {
  const userId = getAuthenticatedUserId(res);
  const client = await sleepStorage(req, res);
  if (!client) return;

  try {
    const [checkIns, journals, routines] = await Promise.all([
      client
        .from("sleep_check_ins")
        .select("*")
        .eq("user_id", userId)
        .order("sleep_date", { ascending: false })
        .limit(7),
      client
        .from("sleep_journal_entries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(7),
      client
        .from("sleep_routine_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("sleep_date", todayUtc())
        .maybeSingle(),
    ]);

    const failed = [checkIns, journals, routines].find((result) => result.error);
    if (failed?.error) {
      logger.warn({ code: errorCode(failed.error) }, "Sleep summary lookup failed");
      res.status(503).json({ error: "Sleep storage is not available" });
      return;
    }

    const todayCheckIn =
      (checkIns.data as SleepCheckInRecord[]).find((entry) => entry.sleep_date === todayUtc()) ?? null;
    res.json({
      todayCheckIn: todayCheckIn ? mapCheckIn(todayCheckIn) : null,
      todayRoutine: routines.data ? mapRoutine(routines.data as SleepRoutineRecord) : null,
      recentCheckIns: (checkIns.data as SleepCheckInRecord[]).map(mapCheckIn),
      recentJournalEntries: (journals.data as SleepJournalRecord[]).map(mapJournal),
    });
  } catch {
    logger.warn("Sleep summary request failed");
    res.status(503).json({ error: "Sleep storage is not available" });
  }
});

router.post("/sleep/check-ins", async (req, res) => {
  const userId = getAuthenticatedUserId(res);
  const body = isRecord(req.body) ? req.body : {};
  const notes = body.notes === null || body.notes === undefined ? null : body.notes;
  if (
    !isDate(body.sleepDate) ||
    typeof body.sleepQuality !== "number" ||
    !Number.isInteger(body.sleepQuality) ||
    body.sleepQuality < 1 ||
    body.sleepQuality > 5 ||
    typeof body.energyLevel !== "number" ||
    !Number.isInteger(body.energyLevel) ||
    body.energyLevel < 1 ||
    body.energyLevel > 5 ||
    typeof body.feeling !== "string" ||
    !(FEELINGS as readonly string[]).includes(body.feeling) ||
    (notes !== null && (typeof notes !== "string" || notes.length > 500))
  ) {
    res.status(400).json({ error: "Invalid sleep check-in" });
    return;
  }

  const client = await sleepStorage(req, res);
  if (!client) return;
  try {
    const { data, error } = await client
      .from("sleep_check_ins")
      .upsert(
        {
          user_id: userId,
          sleep_date: body.sleepDate,
          sleep_quality: body.sleepQuality,
          energy_level: body.energyLevel,
          feeling: body.feeling,
          notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,sleep_date" },
      )
      .select("*")
      .single();
    if (error || !data) {
      logger.warn({ code: errorCode(error) }, "Sleep check-in save failed");
      res.status(503).json({ error: "Sleep storage is not available" });
      return;
    }
    res.status(201).json(mapCheckIn(data as SleepCheckInRecord));
  } catch {
    logger.warn("Sleep check-in request failed");
    res.status(503).json({ error: "Sleep storage is not available" });
  }
});

router.post("/sleep/routine-sessions", async (req, res) => {
  const userId = getAuthenticatedUserId(res);
  const body = isRecord(req.body) ? req.body : {};
  const completedSteps = body.completedSteps;
  if (
    !isDate(body.sleepDate) ||
    !Array.isArray(completedSteps) ||
    completedSteps.length > ROUTINE_STEPS.length ||
    completedSteps.some(
      (step) => typeof step !== "string" || !(ROUTINE_STEPS as readonly string[]).includes(step),
    )
  ) {
    res.status(400).json({ error: "Invalid routine session" });
    return;
  }

  const client = await sleepStorage(req, res);
  if (!client) return;
  try {
    const { data, error } = await client
      .from("sleep_routine_sessions")
      .upsert(
        { user_id: userId, sleep_date: body.sleepDate, completed_steps: completedSteps },
        { onConflict: "user_id,sleep_date" },
      )
      .select("*")
      .single();
    if (error || !data) {
      logger.warn({ code: errorCode(error) }, "Sleep routine save failed");
      res.status(503).json({ error: "Sleep storage is not available" });
      return;
    }
    res.status(201).json(mapRoutine(data as SleepRoutineRecord));
  } catch {
    logger.warn("Sleep routine request failed");
    res.status(503).json({ error: "Sleep storage is not available" });
  }
});

router.post("/sleep/journal", async (req, res) => {
  const userId = getAuthenticatedUserId(res);
  const body = isRecord(req.body) ? req.body : {};
  if (
    !isDate(body.sleepDate) ||
    typeof body.content !== "string" ||
    body.content.trim().length < 1 ||
    body.content.length > 2000
  ) {
    res.status(400).json({ error: "Invalid sleep journal entry" });
    return;
  }

  const client = await sleepStorage(req, res);
  if (!client) return;
  try {
    const { data, error } = await client
      .from("sleep_journal_entries")
      .insert({
        user_id: userId,
        sleep_date: body.sleepDate,
        content: body.content.trim(),
      })
      .select("*")
      .single();
    if (error || !data) {
      logger.warn({ code: errorCode(error) }, "Sleep journal save failed");
      res.status(503).json({ error: "Sleep storage is not available" });
      return;
    }
    res.status(201).json(mapJournal(data as SleepJournalRecord));
  } catch {
    logger.warn("Sleep journal request failed");
    res.status(503).json({ error: "Sleep storage is not available" });
  }
});

router.get("/sleep/insights", async (req, res) => {
  const userId = getAuthenticatedUserId(res);
  const client = await sleepStorage(req, res);
  if (!client) return;

  const plan = await activePlan(client, userId);
  if (PLAN_RANK[plan] < PLAN_RANK.plus) {
    res.status(403).json({ error: "Plus plan required for sleep insights" });
    return;
  }

  try {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 6);
    const { data, error } = await client
      .from("sleep_check_ins")
      .select("sleep_quality, energy_level, sleep_date")
      .eq("user_id", userId)
      .gte("sleep_date", start.toISOString().slice(0, 10))
      .order("sleep_date", { ascending: true });
    if (error) {
      logger.warn({ code: errorCode(error) }, "Sleep insights lookup failed");
      res.status(503).json({ error: "Sleep storage is not available" });
      return;
    }

    const entries = (data ?? []) as Pick<SleepCheckInRecord, "sleep_quality" | "energy_level" | "sleep_date">[];
    const averageQuality = entries.length
      ? Math.round((entries.reduce((sum, entry) => sum + entry.sleep_quality, 0) / entries.length) * 10) / 10
      : 0;
    const averageEnergy = entries.length
      ? Math.round((entries.reduce((sum, entry) => sum + entry.energy_level, 0) / entries.length) * 10) / 10
      : 0;
    const firstHalf = entries.slice(0, Math.ceil(entries.length / 2));
    const secondHalf = entries.slice(Math.ceil(entries.length / 2));
    const average = (items: typeof entries) =>
      items.length ? items.reduce((sum, entry) => sum + entry.sleep_quality, 0) / items.length : 0;
    const delta = average(secondHalf) - average(firstHalf);
    res.json({
      plan,
      nightsTracked: entries.length,
      averageQuality,
      averageEnergy,
      trend: delta > 0.35 ? "improving" : delta < -0.35 ? "gentler_start" : "steady",
    });
  } catch {
    logger.warn("Sleep insights request failed");
    res.status(503).json({ error: "Sleep storage is not available" });
  }
});

export default router;