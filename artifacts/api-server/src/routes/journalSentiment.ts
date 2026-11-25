import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";

const router = Router();

const ALLOWED_PROVIDERS = ["deepseek", "openai"] as const;
type Provider = (typeof ALLOWED_PROVIDERS)[number];
const PROVIDER_URLS: Record<Provider, string> = {
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
};
const DEFAULT_MODELS: Record<Provider, string> = {
  deepseek: "deepseek-chat",
  openai: "gpt-4o-mini",
};
const LANGUAGES = new Set(["en", "id", "ja", "ar"]);
const FIELD_LIMIT = 400;

const SYSTEM_PROMPT = `You estimate the distress tone of a short journal note for KindEase.
Return strict JSON only: {"distress": <integer 0-100>}.
0 is settled. 100 is very distressed. This is an estimate of wording, not a diagnosis.
You are not a doctor, therapist, or healthcare professional.
Do not name a disorder, do not say the person has anxiety or depression, and do not give clinical advice.
If the note describes suicide, self-harm, or crisis, still return only the JSON number. Do not give instructions.`;

function clip(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u001F]/g, " ").trim().slice(0, FIELD_LIMIT);
}

function parseDistress(raw: string): number | null {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as { distress?: unknown };
      const value = Number(parsed.distress);
      if (Number.isFinite(value)) return Math.max(0, Math.min(100, Math.round(value)));
    } catch {
      // Fall through to a bare integer.
    }
  }
  const match = trimmed.match(/\b(\d{1,3})\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value > 100) return null;
  return Math.round(value);
}

router.post("/ai/journal-sentiment", async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";
  const rawProvider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const provider: Provider | null = (ALLOWED_PROVIDERS as readonly string[]).includes(rawProvider)
    ? (rawProvider as Provider)
    : null;
  const apiKey = process.env.AI_PROVIDER_API_KEY ?? "";
  const model = process.env.AI_MODEL || DEFAULT_MODELS[provider ?? "deepseek"];

  if (!provider || !apiKey) {
    res.status(503).json({ error: "Journal tone estimate is not available" });
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing authentication token" });
    return;
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: "Server authentication not configured" });
    return;
  }

  let userSupabase: ReturnType<typeof createClient>;
  try {
    userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data, error } = await userSupabase.auth.getUser();
    if (error || !data.user?.id) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
  } catch {
    res.status(401).json({ error: "Authentication failed" });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const language = typeof body.language === "string" && LANGUAGES.has(body.language) ? body.language : "en";
  const situation = clip(body.situation);
  const trigger = clip(body.trigger);
  const reframe = clip(body.reframe);
  if (!situation && !trigger && !reframe) {
    res.status(400).json({ error: "Journal text is required" });
    return;
  }

  const { data: quota, error: quotaError } = await (
    userSupabase.rpc("coach_monthly_status") as unknown as Promise<{
      data: { allowed?: boolean } | number | null;
      error: { message?: string } | null;
    }>
  );
  if (quotaError) {
    res.status(503).json({ error: "Journal tone estimate is not available" });
    return;
  }
  const allowed = typeof quota === "object" && quota !== null ? Boolean(quota.allowed) : quota !== null;
  if (!allowed) {
    res.status(429).json({ error: "Monthly companion limit reached" });
    return;
  }

  try {
    const response = await fetch(`${PROVIDER_URLS[provider]}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 40,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Language: ${language}\nSituation: ${situation}\nTrigger: ${trigger}\nReframe: ${reframe}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      res.status(502).json({ error: "Journal tone estimate is not available" });
      return;
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const distress = parseDistress(payload.choices?.[0]?.message?.content ?? "");
    if (distress == null) {
      res.status(502).json({ error: "Journal tone estimate is not available" });
      return;
    }
    res.json({ distress });
  } catch (error) {
    logger.warn({ message: error instanceof Error ? error.message : "provider" }, "Journal sentiment failed");
    res.status(502).json({ error: "Journal tone estimate is not available" });
  }
});

export default router;
