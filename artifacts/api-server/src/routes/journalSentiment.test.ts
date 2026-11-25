import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import app from "../app";

const rpc = vi.fn(async (fn: string) => {
  if (fn === "coach_record_successful_message") {
    throw new Error("sentiment must not record coach usage");
  }
  return { data: { allowed: true, remaining: 9, used: 1, plan: "free" }, error: null };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-abc-123" } },
        error: null,
      })),
    },
    rpc,
  })),
}));

const request = supertest(app);

function setEnv() {
  process.env.AI_PROVIDER = "deepseek";
  process.env.AI_PROVIDER_API_KEY = "test-key";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnv();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === "coach_record_successful_message") {
      throw new Error("sentiment must not record coach usage");
    }
    return { data: { allowed: true, remaining: 9, used: 1, plan: "free" }, error: null };
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/ai/journal-sentiment", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request.post("/api/ai/journal-sentiment").send({ situation: "A hard day" });
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not call the provider when the monthly coach cap is closed", async () => {
    rpc.mockResolvedValue({ data: { allowed: false, remaining: 0, used: 10, plan: "free" }, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await request
      .post("/api/ai/journal-sentiment")
      .set("Authorization", "Bearer token")
      .send({ situation: "A hard day", language: "en" });
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(["coach_monthly_status"]);
  });

  it("returns a distress integer without recording a companion message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"distress": 62}' } }] }),
    })));
    const res = await request
      .post("/api/ai/journal-sentiment")
      .set("Authorization", "Bearer token")
      .send({ situation: "I felt rushed", trigger: "The deadline", reframe: "One task is enough", language: "en" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ distress: 62 });
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(["coach_monthly_status"]);
  });
});
