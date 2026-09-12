/**
 * Tests for the server-side system prompt sent to the AI provider.
 *
 * The system prompt is never exported directly, so we inspect what the
 * mocked fetch receives: the `system` message in the messages array.
 *
 * Verified properties:
 *  1. Requests concise responses (word-count / sentence guidance).
 *  2. Prioritises empathy — acknowledgement must come first.
 *  3. Limits the AI to at most one question per reply.
 *  4. Prohibits mental-health diagnosis or labelling.
 *  5. Prohibits claiming to be a doctor/therapist/psychologist.
 *  6. Preserves the crisis safety response path and helpline numbers.
 *  7. Supports en, id, and ja with per-language ABSOLUTE language rules.
 */

import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import supertest from "supertest";
import app from "../app";

const request = supertest(app);

// ── Supabase mock (same as main test file) ────────────────────────────────────
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-prompt-test" } },
        error: null,
      })),
    },
    rpc: vi.fn(async () => ({ data: 1, error: null })),
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function setEnv() {
  process.env.AI_PROVIDER = "openai";
  process.env.AI_PROVIDER_API_KEY = "test-key";
  process.env.AI_MODEL = "gpt-4o-mini";
  process.env.SUPABASE_URL = "https://testproj.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
}

function clearEnv() {
  delete process.env.AI_PROVIDER;
  delete process.env.AI_PROVIDER_API_KEY;
  delete process.env.AI_MODEL;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  clearEnv();
  vi.unstubAllGlobals();
});

/**
 * Fire one successful coach request for the given language and return the
 * system message string that was sent to the AI provider.
 */
async function captureSystemPrompt(language = "en"): Promise<string> {
  setEnv();

  let capturedBody: unknown;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: unknown, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Noted." } }],
        }),
      };
    }),
  );

  const res = await request
    .post("/api/ai/coach")
    .set("Authorization", "Bearer test-bearer")
    .send({
      history: [{ role: "user", content: "I feel overwhelmed today." }],
      context: {
        language,
        tasks: [],
        anxietyChecks: [],
        journalEntries: [],
        todayCompleted: 0,
        todayPlanned: 0,
      },
    });

  expect(res.status).toBe(200);

  const messages = (capturedBody as { messages: { role: string; content: string }[] })
    .messages;
  const systemMsg = messages.find((m) => m.role === "system");
  expect(systemMsg).toBeDefined();
  return systemMsg!.content;
}

// ── 1. Concise response guidance ─────────────────────────────────────────────

describe("system prompt — concise response guidance", () => {
  it("instructs the AI to keep responses to 2–4 short sentences or ~40–80 words", async () => {
    const prompt = await captureSystemPrompt("en");
    // Word/sentence count guidance must be present
    expect(prompt).toMatch(/2[–-]4 short sentence/i);
    expect(prompt).toMatch(/40[–-]80 word/i);
  });

  it("instructs the AI not to use bullet or numbered lists by default", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/do not use bullet|numbered list/i);
  });
});

// ── 2. Empathy-first priority ─────────────────────────────────────────────────

describe("system prompt — empathy-first response pattern", () => {
  it("instructs the AI to open by acknowledging the user's feeling", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/acknowledg|feeling or situation/i);
  });

  it("describes a response pattern that starts with empathy before advice", async () => {
    const prompt = await captureSystemPrompt("en");
    // Pattern step 1 must be empathy, not advice
    expect(prompt).toMatch(/1\..*empath/i);
  });

  it("instructs the AI to validate the user's feeling without judgment", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/validate.*feeling|without judgment/i);
  });
});

// ── 3. One-question limit ─────────────────────────────────────────────────────

describe("system prompt — at most one question per reply", () => {
  it("says 'at most ONE' or 'one gentle question'", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/at most ONE.*question|one gentle.*question/i);
  });

  it("prohibits stacking multiple questions", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/do not stack|not both/i);
  });
});

// ── 4. No mental-health diagnosis ────────────────────────────────────────────

describe("system prompt — diagnosis prohibition", () => {
  it("prohibits diagnosing or labelling the user's mental state", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/do not diagnose|do not.*label.*mental/i);
  });

  it("includes examples of forbidden diagnostic language", async () => {
    const prompt = await captureSystemPrompt("en");
    // Examples: "you have anxiety", "this sounds like depression"
    expect(prompt).toMatch(/anxiety|depression/i);
  });

  it("prohibits prescriptive language like 'you must'", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/never use.*prescriptive|you must.*you should/i);
  });
});

// ── 5. No professional impersonation ─────────────────────────────────────────

describe("system prompt — no professional impersonation", () => {
  it("declares NOT a doctor, therapist, or psychologist", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/NOT a doctor/i);
    expect(prompt).toMatch(/therapist/i);
    expect(prompt).toMatch(/psychologist/i);
  });

  it("prohibits role-playing as a medical or mental health professional", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/never role-play as a medical/i);
  });

  it("prohibits medical diagnoses or clinical advice", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/medical diagnos|clinical advice/i);
  });
});

// ── 6. Crisis safety preserved ───────────────────────────────────────────────

describe("system prompt — crisis safety flow", () => {
  it("contains the mandatory crisis-response text with helpline numbers", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toContain("119");       // Indonesia
    expect(prompt).toContain("988");       // US
    expect(prompt).toContain("116 123");   // UK
    expect(prompt).toContain("13 11 14"); // Australia
  });

  it("instructs to respond ONLY with the safety message on crisis keywords", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/respond ONLY with the following/i);
  });

  it("includes suicide and self-harm as trigger conditions", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/suicide|self-harm/i);
  });
});

// ── 7. Language support for en, id, ja ───────────────────────────────────────

describe("system prompt — language enforcement for launch languages", () => {
  it("includes an ABSOLUTE language rule for English (en)", async () => {
    const prompt = await captureSystemPrompt("en");
    expect(prompt).toMatch(/ABSOLUTE RULE.*English|Respond ONLY in English/i);
  });

  it("includes an ABSOLUTE language rule for Indonesian (id)", async () => {
    const prompt = await captureSystemPrompt("id");
    expect(prompt).toMatch(/ABSOLUTE RULE.*Indonesian|Bahasa Indonesia/i);
  });

  it("includes an ABSOLUTE language rule for Japanese (ja)", async () => {
    const prompt = await captureSystemPrompt("ja");
    expect(prompt).toMatch(/ABSOLUTE RULE.*Japanese|日本語のみ/);
  });

  it("each language prompt contains the same safety rules regardless of locale", async () => {
    // Run sequentially — parallel stubs share the global fetch and capturedBody
    const en = await captureSystemPrompt("en");
    const id = await captureSystemPrompt("id");
    const ja = await captureSystemPrompt("ja");
    for (const prompt of [en, id, ja]) {
      expect(prompt).toMatch(/NOT a doctor/i);
      expect(prompt).toMatch(/respond ONLY with the following/i);
      expect(prompt).toContain("988");
    }
  });
});
