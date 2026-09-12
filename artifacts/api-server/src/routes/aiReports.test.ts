import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import { logger } from "../lib/logger";
import { createReportableResponseToken } from "../lib/reportToken";

const mocks = vi.hoisted(() => {
  const state = {
    authenticatedUserId: "verified-user-id",
    tokenIsValid: true,
    rpcResult: "accepted" as "accepted" | "duplicate" | "daily_limit",
    rpcError: null as { code: string } | null,
    rpcCalls: [] as Array<{ functionName: string; args: Record<string, unknown> }>,
  };

  const authClient = {
    auth: {
      getUser: vi.fn(async () =>
        state.tokenIsValid
          ? { data: { user: { id: state.authenticatedUserId } }, error: null }
          : { data: { user: null }, error: { message: "invalid token" } },
      ),
    },
  };

  const adminClient = {
    rpc: vi.fn(async (functionName: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ functionName, args });
      return { data: state.rpcResult, error: state.rpcError };
    }),
  };

  const createClient = vi.fn((_url: string, key: string) =>
    key === "service-role-key" ? adminClient : authClient,
  );

  return { state, authClient, adminClient, createClient };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import app from "../app";

const request = supertest(app);
const auth = { Authorization: "Bearer verified-token" };
function validPayload() {
  return {
    category: "harmful_or_unsafe",
    optionalNote: "This might cause harm",
    reportToken: createReportableResponseToken(
      "verified-user-id",
      "Server-issued assistant response",
      "en",
    ),
    reportClientId: "e7f3b1c4-6b7a-4f9d-9db6-43e414d2a1a2",
  };
}

function resetState() {
  mocks.state.authenticatedUserId = "verified-user-id";
  mocks.state.tokenIsValid = true;
  mocks.state.rpcResult = "accepted";
  mocks.state.rpcError = null;
  mocks.state.rpcCalls = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  resetState();
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.SESSION_SECRET = "test-session-secret";
});

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SESSION_SECRET;
});

describe("POST /api/ai/reports — authentication and validation", () => {
  it("rejects missing and invalid tokens before saving a report", async () => {
    const noToken = await request.post("/api/ai/reports").send(validPayload());
    expect(noToken.status).toBe(401);

    mocks.state.tokenIsValid = false;
    const invalidToken = await request.post("/api/ai/reports").set(auth).send(validPayload());
    expect(invalidToken.status).toBe(401);
    expect(mocks.state.rpcCalls).toHaveLength(0);
  });

  it.each([
    [{ category: "anything_goes" }],
    [{ optionalNote: "x".repeat(501) }],
    [{ reportToken: "not-a-signed-token" }],
    [{ reportClientId: "not-a-uuid" }],
  ])("rejects an invalid report payload", async (payload) => {
    const response = await request
      .post("/api/ai/reports")
      .set(auth)
      .send({ ...validPayload(), ...payload });
    expect(response.status).toBe(400);
    expect(mocks.state.rpcCalls).toHaveLength(0);
  });
});

describe("POST /api/ai/reports — ownership and storage", () => {
  it("uses only the verified JWT identity and never accepts a forged identity", async () => {
    const response = await request
      .post("/api/ai/reports")
      .set(auth)
      .send({
        ...validPayload(),
        userId: "attacker-id",
        email: "attacker@example.com",
        assistantResponse: "forged user message that must never be saved",
        language: "fr",
      });

    expect(response.status).toBe(204);
    expect(mocks.state.rpcCalls).toEqual([
      expect.objectContaining({
        functionName: "submit_ai_content_report",
        args: expect.objectContaining({
          p_user_id: "verified-user-id",
          p_assistant_response: "Server-issued assistant response",
          p_language: "en",
        }),
      }),
    ]);
    expect(mocks.state.rpcCalls[0].args).not.toHaveProperty("email");
    expect(mocks.state.rpcCalls[0].args).not.toHaveProperty("assistantResponse");
  });

  it("rejects a valid report token issued for another user", async () => {
    const response = await request.post("/api/ai/reports").set(auth).send({
      ...validPayload(),
      reportToken: createReportableResponseToken(
        "other-user-id",
        "Another user's response",
        "en",
      ),
    });

    expect(response.status).toBe(400);
    expect(mocks.state.rpcCalls).toHaveLength(0);
  });

  it("returns no report contents after a successful save", async () => {
    const payload = validPayload();
    const response = await request.post("/api/ai/reports").set(auth).send(payload);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(JSON.stringify(response.body)).not.toContain("Server-issued assistant response");
    expect(JSON.stringify(response.body)).not.toContain(payload.optionalNote);
  });

  it("rejects duplicate report client IDs without storing a second report", async () => {
    mocks.state.rpcResult = "duplicate";

    const response = await request.post("/api/ai/reports").set(auth).send(validPayload());

    expect(response.status).toBe(409);
  });

  it("applies a separate daily report limit", async () => {
    mocks.state.rpcResult = "daily_limit";

    const response = await request.post("/api/ai/reports").set(auth).send(validPayload());

    expect(response.status).toBe(429);
  });
});

describe("POST /api/ai/reports — safe failures and logging", () => {
  it("returns 503 when the reporting service is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await request.post("/api/ai/reports").set(auth).send(validPayload());

    expect(response.status).toBe(503);
  });

  it("does not put report content, user ID, or tokens in logs or responses", async () => {
    const sensitivePayload = {
      ...validPayload(),
      optionalNote: "secret reviewer note",
      reportToken: createReportableResponseToken(
        "sensitive-user-id",
        "Server-issued assistant response",
        "en",
      ),
    };
    mocks.state.authenticatedUserId = "sensitive-user-id";
    mocks.state.rpcError = { code: "PGRST999" };
    const warnSpy = vi.spyOn(logger, "warn");
    const errorSpy = vi.spyOn(logger, "error");

    const response = await request
      .post("/api/ai/reports")
      .set("Authorization", "Bearer sensitive-token")
      .send(sensitivePayload);

    expect(response.status).toBe(503);
    const observed = JSON.stringify([
      response.body,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ]);
    expect(observed).not.toContain("Server-issued assistant response");
    expect(observed).not.toContain("secret reviewer note");
    expect(observed).not.toContain("sensitive-user-id");
    expect(observed).not.toContain("sensitive-token");
  });
});