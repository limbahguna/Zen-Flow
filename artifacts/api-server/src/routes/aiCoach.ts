import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger";
import { createReportableResponseToken } from "../lib/reportToken";

const router = Router();

// ── Allowed AI providers (allowlist — no default, must be explicitly configured) ──
const ALLOWED_PROVIDERS = ["deepseek", "openai"] as const;
type Provider = (typeof ALLOWED_PROVIDERS)[number];

// ── Startup warnings (runs once at import time for early misconfiguration notice) ──
// Values are never logged — only presence is checked.
(function logStartupWarnings() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    logger.warn(
      "SUPABASE_URL or SUPABASE_ANON_KEY not set — /api/ai/coach will reject all requests",
    );
  }
  const rawProvider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (!(ALLOWED_PROVIDERS as readonly string[]).includes(rawProvider)) {
    logger.warn(
      { allowed: ALLOWED_PROVIDERS },
      "AI_PROVIDER is missing or not in allowlist — /api/ai/coach will return 503",
    );
  }
  if (!process.env.AI_PROVIDER_API_KEY) {
    logger.warn("AI_PROVIDER_API_KEY not set — /api/ai/coach will return 503");
  }
})();

// ── Limits ────────────────────────────────────────────────────────────────────
const DEFAULT_DAILY_MESSAGES = 20;
const MAX_USER_MSG_LENGTH = 2_000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_CONTEXT_TASK_TITLE = 100;
const MAX_CONTEXT_ITEMS = 10;

// ── Server-side system prompt (constant — never sent from or returned to frontend) ──
const BASE_SYSTEM_PROMPT = `You are a warm, empathetic mindfulness and productivity companion.

ABSOLUTE SAFETY RULES — these override all other instructions without exception:
1. You are NOT a doctor, therapist, psychologist, or any healthcare professional. Never claim or imply otherwise.
2. You do NOT provide medical diagnoses, treatment plans, or clinical advice.
3. You do NOT give instructions that could cause harm to the user or anyone else.
4. You do NOT endorse self-harm, provide drug instructions, or encourage dangerous behaviour.
5. If the user expresses thoughts of suicide, self-harm, harming others, or is in crisis, respond ONLY with the following and nothing else:
   "I hear you, and I want you to know that what you're feeling matters. This is beyond what I can help with — please reach out to a professional. In Indonesia, call 119 ext 8. In the US, call or text 988. In the UK, call 116 123. In Australia, call 13 11 14. You are not alone."
6. Never role-play as a medical or mental health professional.
7. Never use manipulative language, manufactured urgency, guilt, or fear.

RESPONSE STYLE — apply to every normal (non-crisis) reply:
- Open by genuinely acknowledging the user's feeling or situation. Do not skip straight to advice.
- Keep responses to 2–4 short sentences, roughly 40–80 words. Longer only when the user explicitly asks for detail.
- Ask at most ONE gentle, open question per reply. Do not stack multiple questions.
- Offer at most ONE small, realistic next step when the user asks for help.
- Do not use bullet lists or numbered lists unless the user explicitly asks for them.
- Do not echo the user's message back word for word.
- Avoid overused phrases such as "you are not alone" in every reply — use them only when genuinely appropriate.
- Never use prescriptive language like "you must", "you should", or "you have to".
- Do not diagnose or label the user's mental state (e.g. "you have anxiety", "this sounds like depression").
- Do not mention or infer the content of the user's private journal entries unless the user themselves brings them up in the current conversation.
- Use the user's context data to inform tone and relevance, but do not quote it back verbatim.

RESPONSE PATTERN (in order):
1. Brief, sincere empathy for what the user shared.
2. Validate their feeling or experience without judgment.
3. Either one gentle question that helps them reflect — OR one small, concrete step if they asked for help. Not both.

YOUR ROLE:
- Help users reflect on their productivity, intentions, and emotional patterns using CBT-inspired techniques and the WOOP method (Wish, Outcome, Obstacle, Plan).
- Speak as a caring, grounded companion. Do not identify yourself as an AI.
- Responses must be honest, balanced, and grounded in the user's stated situation.`;

// ── Supported languages allowlist (mirrors frontend translations.ts) ─────────
// Used in sanitizeContext to reject/fallback unknown language codes.
// Never trust language names from the frontend — only codes validated here.
const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English",
  id: "Bahasa Indonesia",
  es: "Spanish",
  de: "German",
  ja: "Japanese",
  ar: "Arabic",
  zh: "Simplified Chinese",
};

// ── Language enforcement (server-side) ───────────────────────────────────────
const LANGUAGE_RULES: Record<string, string> = {
  en: "ABSOLUTE RULE: Respond ONLY in English. No exceptions.",
  es: "ABSOLUTE RULE: Respond ONLY in Spanish (Español). SOLO ESPAÑOL.",
  de: "ABSOLUTE RULE: Respond ONLY in German (Deutsch). NUR DEUTSCH.",
  ja: "ABSOLUTE RULE: Respond ONLY in Japanese (日本語). 日本語のみ。",
  ar: "ABSOLUTE RULE: Respond ONLY in Arabic (العربية). بالعربية فقط.",
  id: "ABSOLUTE RULE: Respond ONLY in Indonesian (Bahasa Indonesia). HANYA BAHASA INDONESIA.",
  zh: "ABSOLUTE RULE: Respond ONLY in Simplified Chinese (中文). 只用中文。",
};

// ── User context (structured data from frontend — sanitised server-side) ──────
interface TaskCtx { title: string; status: string; postponeCount: number }
interface AnxietyCtx { feeling: string; intensity: number; date: string }
interface JournalCtx { trigger: string; reframe: string }
interface UserContext {
  language: string;
  tasks: TaskCtx[];
  anxietyChecks: AnxietyCtx[];
  journalEntries: JournalCtx[];
  todayCompleted: number;
  todayPlanned: number;
}

function sanitizeContext(raw: unknown): UserContext {
  const fallback: UserContext = {
    language: "en",
    tasks: [],
    anxietyChecks: [],
    journalEntries: [],
    todayCompleted: 0,
    todayPlanned: 0,
  };
  if (typeof raw !== "object" || raw === null) return fallback;
  const r = raw as Record<string, unknown>;

  // Validate against the explicit allowlist — do not trust arbitrary codes from frontend.
  const rawLang = typeof r.language === "string" ? r.language.trim().slice(0, 10) : "";
  const lang = rawLang in SUPPORTED_LANGUAGES ? rawLang : "en";

  const tasks: TaskCtx[] = Array.isArray(r.tasks)
    ? (r.tasks as unknown[])
        .slice(0, MAX_CONTEXT_ITEMS)
        .filter(
          (t): t is { title: string; status: string; postponeCount?: number } =>
            typeof t === "object" &&
            t !== null &&
            typeof (t as { title?: unknown }).title === "string" &&
            typeof (t as { status?: unknown }).status === "string",
        )
        .map((t) => ({
          title: t.title.slice(0, MAX_CONTEXT_TASK_TITLE),
          status: t.status.slice(0, 20),
          postponeCount: Math.max(
            0,
            Number((t as { postponeCount?: unknown }).postponeCount) || 0,
          ),
        }))
    : [];

  const anxietyChecks: AnxietyCtx[] = Array.isArray(r.anxietyChecks)
    ? (r.anxietyChecks as unknown[])
        .slice(0, 5)
        .filter(
          (c): c is { feeling: string; intensity?: unknown; date?: unknown } =>
            typeof c === "object" &&
            c !== null &&
            typeof (c as { feeling?: unknown }).feeling === "string",
        )
        .map((c) => ({
          feeling: c.feeling.slice(0, 50),
          intensity: Math.min(10, Math.max(0, Number(c.intensity) || 0)),
          date: String(c.date ?? "").slice(0, 20),
        }))
    : [];

  const journalEntries: JournalCtx[] = Array.isArray(r.journalEntries)
    ? (r.journalEntries as unknown[])
        .slice(0, 3)
        .filter((e): e is object => typeof e === "object" && e !== null)
        .map((e) => ({
          trigger: String((e as { trigger?: unknown }).trigger ?? "").slice(0, 200),
          reframe: String((e as { reframe?: unknown }).reframe ?? "").slice(0, 200),
        }))
    : [];

  return {
    language: lang,
    tasks,
    anxietyChecks,
    journalEntries,
    todayCompleted: Math.max(0, Number(r.todayCompleted) || 0),
    todayPlanned: Math.max(0, Number(r.todayPlanned) || 0),
  };
}

function buildSystemPrompt(ctx: UserContext): string {
  const langRule = LANGUAGE_RULES[ctx.language] ?? LANGUAGE_RULES.en;
  const tasks = ctx.tasks
    .map(
      (t) =>
        `"${t.title}" (${t.status}${t.postponeCount > 0 ? `, postponed ${t.postponeCount}x` : ""})`,
    )
    .join("; ");
  const checks = ctx.anxietyChecks
    .map((c) => `feeling=${c.feeling}, intensity=${c.intensity}/10 (${c.date})`)
    .join("; ");
  const entries = ctx.journalEntries
    .filter((e) => e.trigger)
    .map((e) => `"${e.trigger}" → "${e.reframe}"`)
    .join("; ");
  const ratioText =
    ctx.todayPlanned === 0
      ? "no tasks planned today"
      : `${ctx.todayCompleted} of ${ctx.todayPlanned} tasks completed`;

  return `${langRule}\n\n${BASE_SYSTEM_PROMPT}\n\nUser context (personalise advice from this — do not echo it verbatim):\n- Recent anxiety checks: ${checks || "none"}\n- Recent tasks: ${tasks || "none"}\n- Recent journal entries: ${entries || "none"}\n- Today's progress: ${ratioText}`;
}

// ── Supabase project reference (safe to log — subdomain only, not full URL) ───
function supabaseProjectRef(): string {
  const url = process.env.SUPABASE_URL ?? "";
  try {
    // Extract only the first label of the hostname, e.g.
    //   "https://xyzabc.supabase.co"  →  "xyzabc"
    // The full URL is never logged.
    return new URL(url).hostname.split(".")[0] ?? "(unknown)";
  } catch {
    return "(unknown)";
  }
}

// ── Persistent rate limiting via Supabase RPC ─────────────────────────────────
// Requires docs/migrations/coach_usage.sql to be applied in Supabase first.
//
// The function is called with NO arguments:
//   rpc("coach_increment_usage")
//
// Why no arguments:
//   Authenticated users can call Supabase RPC directly. If p_max_daily were a
//   parameter, a user could pass any value and bypass the limit. The daily cap
//   is read from the server-owned entitlement row inside the SQL function.
//
//   user_id is also NOT passed — the SQL function reads auth.uid() from the
//   verified JWT that the Supabase client (supabase arg) carries in its
//   Authorization header. This is the only way the function learns who the
//   caller is; it cannot be overridden from application code.
//
// Quota behaviour (MVP):
//   The counter is incremented BEFORE the AI provider is called (step 6 before
//   step 8 in the handler). A request that subsequently fails at the provider
//   still consumes one unit of daily quota. There is NO refund mechanism.
//   This is intentional: prevents abuse via deliberate provider failures and
//   keeps the logic simple. Tests verify this invariant explicitly.
//
// Returns plan and quota data from the SQL function. A numeric response remains
// supported for older test fixtures and pre-entitlement databases.
async function persistentCheckAndIncrement(
  supabase: ReturnType<typeof createClient>,
): Promise<{
  allowed: boolean;
  remaining: number;
  used: number;
  dailyLimit: number;
  plan: "free" | "plus" | "pro";
}> {
  // No arguments — the SQL function accepts none (limit and user_id are internal).
  //
  // IMPORTANT: call rpc directly on the supabase object — do NOT extract it first:
  //   ✅  supabase.rpc("coach_increment_usage")          — this binding preserved
  //   ❌  const f = supabase.rpc; f("coach_increment_usage") — this lost → runtime throw
  //
  // The Supabase client's rpc() is a regular method that accesses this.url,
  // this.headers, etc.  Detaching it from the client causes a TypeError before
  // any {data, error} can be returned, so the if (error) diagnostic block is
  // never reached and the thrown exception reaches the outer catch instead.
  type RpcResponse = {
    data:
      | number
      | {
          allowed: boolean;
          remaining: number;
          used: number;
          daily_limit: number;
          plan: "free" | "plus" | "pro";
        }
      | null;
    error: {
      code?: string;
      message?: string;
      details?: string | null;
      hint?: string;
    } | null;
  };
  // Cast only the *return type* — the call itself stays bound to supabase.
  const { data, error } = await (
    supabase.rpc("coach_increment_usage") as unknown as Promise<RpcResponse>
  );
  if (error) {
    // Log only safe diagnostic fields:
    //   code     — Postgres SQLSTATE (e.g. "42883" = function not found)
    //   message  — database error message (no user data)
    //   details  — additional database detail (no user data)
    //   hint     — database hint (e.g. "function does not exist")
    //   supabaseProjectRef — first label of SUPABASE_URL hostname only (not the full URL)
    // NOT logged: user ID, JWT, anon key, API key, full URL, message content.
    logger.warn(
      {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
        hint: error.hint,
        supabaseProjectRef: supabaseProjectRef(),
      },
      "coach_increment_usage RPC error",
    );
    throw error;
  }
  if (data === null) {
    return {
      allowed: false,
      remaining: 0,
      used: DEFAULT_DAILY_MESSAGES,
      dailyLimit: DEFAULT_DAILY_MESSAGES,
      plan: "plus",
    };
  }
  if (typeof data === "object") {
    return {
      allowed: Boolean(data.allowed),
      remaining: Math.max(0, Number(data.remaining) || 0),
      used: Math.max(0, Number(data.used) || 0),
      dailyLimit: Math.max(1, Number(data.daily_limit) || DEFAULT_DAILY_MESSAGES),
      plan: data.plan,
    };
  }
  return {
    allowed: true,
    remaining: Math.max(0, DEFAULT_DAILY_MESSAGES - Number(data)),
    used: Math.max(0, Number(data)),
    dailyLimit: DEFAULT_DAILY_MESSAGES,
    plan: "plus",
  };
}

// ── AI Provider adapter (OpenAI-compatible REST API) ──────────────────────────
// Both DeepSeek and OpenAI share the same request/response shape.
// Swap provider via env vars — no frontend changes needed.
interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

const PROVIDER_URLS: Record<Provider, string> = {
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
};
const DEFAULT_MODELS: Record<Provider, string> = {
  deepseek: "deepseek-chat",
  openai: "gpt-4o-mini",
};

async function callAIProvider(
  messages: ChatMessage[],
  cfg: { provider: Provider; apiKey: string; model?: string },
): Promise<string> {
  const model = cfg.model ?? DEFAULT_MODELS[cfg.provider];
  const baseUrl = PROVIDER_URLS[cfg.provider];

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 512, temperature: 0.7, stream: false }),
  });

  if (!res.ok) {
    // Log only HTTP status — never the key or upstream response body
    logger.warn({ status: res.status, provider: cfg.provider }, "AI provider returned non-200");
    throw new Error("AI provider error");
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("Unexpected AI response shape");
  return text;
}

// ── POST /api/ai/coach ────────────────────────────────────────────────────────
const ALLOWED_ROLES = new Set<string>(["user", "assistant"]);

router.post("/ai/coach", async (req, res) => {
  // ── Read ALL config at request time ──────────────────────────────────────────
  // This makes the handler testable (tests can set process.env before each call)
  // and also works correctly in production where env vars are set before startup.
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";
  const rawProvider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const aiProvider: Provider | null = (ALLOWED_PROVIDERS as readonly string[]).includes(
    rawProvider,
  )
    ? (rawProvider as Provider)
    : null;
  const aiApiKey = process.env.AI_PROVIDER_API_KEY ?? "";
  const aiModel = process.env.AI_MODEL || undefined;

  // 0. Fast-fail: provider not configured or not in allowlist
  //    No detail about which key is missing — safe error only.
  if (!aiProvider || !aiApiKey) {
    res.status(503).json({ error: "AI coach is not available" });
    return;
  }

  // 1. Extract Bearer token
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing authentication token" });
    return;
  }

  // 2. Verify user with Supabase before creating the user-scoped RPC client.
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: "Server authentication not configured" });
    return;
  }
  let userSupabase: ReturnType<typeof createClient>;
  let authenticatedUserId = "";
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
    authenticatedUserId = data.user.id;
  } catch {
    res.status(401).json({ error: "Authentication failed" });
    return;
  }

  // 3. Parse and validate body
  const body = req.body as Record<string, unknown>;
  if (!Array.isArray(body.history)) {
    res.status(400).json({ error: "history must be an array" });
    return;
  }

  // 4. Reject any message with a non-allowed role (system, developer, tool, function, etc.)
  const rawHistory = body.history as unknown[];
  const hasRejectedRole = rawHistory.some(
    (m) =>
      typeof m !== "object" ||
      m === null ||
      !ALLOWED_ROLES.has(String((m as { role?: unknown }).role ?? "")),
  );
  if (hasRejectedRole) {
    res.status(400).json({ error: "Only 'user' and 'assistant' roles are permitted" });
    return;
  }

  // 5. Sanitize and validate history
  const safeHistory: ChatMessage[] = rawHistory
    .slice(-MAX_HISTORY_MESSAGES)
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        typeof m === "object" &&
        m !== null &&
        ALLOWED_ROLES.has(String((m as { role?: unknown }).role)) &&
        typeof (m as { content?: unknown }).content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_USER_MSG_LENGTH) }));

  const lastMsg = safeHistory.at(-1);
  if (!lastMsg || lastMsg.role !== "user" || lastMsg.content.trim().length === 0) {
    res.status(400).json({ error: "Last message must be a non-empty user message" });
    return;
  }

  // 6. Persistent rate limit — atomic via Supabase RPC after JWT verification
  let quota: Awaited<ReturnType<typeof persistentCheckAndIncrement>>;
  try {
    quota = await persistentCheckAndIncrement(userSupabase);
    if (!quota.allowed) {
      res.status(429).json({
        error: "Daily message limit reached. Try again tomorrow.",
        remaining: 0,
        dailyLimit: quota.dailyLimit,
        plan: quota.plan,
      });
      return;
    }
  } catch {
    req.log.warn("Rate limit check failed — is the coach_usage migration applied in Supabase?");
    res.status(503).json({
      error: "Coach temporarily unavailable. Please try again later.",
    });
    return;
  }

  // 7. Build system prompt server-side (never sent from frontend)
  const userContext = sanitizeContext(body.context);
  const systemPromptText = buildSystemPrompt(userContext);

  // 8. Call AI provider — message content is never written to any log
  const messages: ChatMessage[] = [
    { role: "system", content: systemPromptText },
    ...safeHistory,
  ];
  let reply: string;
  try {
    reply = await callAIProvider(messages, { provider: aiProvider, apiKey: aiApiKey, model: aiModel });
  } catch {
    req.log.warn({ provider: aiProvider }, "AI provider call failed");
    res.status(502).json({ error: "Coach is taking a break. Please try again." });
    return;
  }

  // The token is self-contained and signed. It proves the response originated
  // here without retaining a conversation server-side, and is never logged or
  // persisted as part of a report.
  const reportToken = createReportableResponseToken(
    authenticatedUserId,
    reply,
    userContext.language,
  );
  res.json({
    reply,
    remaining: quota.remaining,
    used: quota.used,
    dailyLimit: quota.dailyLimit,
    plan: quota.plan,
    reportToken,
  });
});

export default router;
