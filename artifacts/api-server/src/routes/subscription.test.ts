import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import app from "../app";

const fixture = vi.hoisted(() => ({
  plan: "free" as string | null,
  count: 0,
}));

function makeClient() {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "subscription-user" } }, error: null })),
    },
    from: vi.fn((table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => {
          if (table === "user_entitlements") {
            return { data: fixture.plan ? { plan: fixture.plan } : null, error: null };
          }
          return { data: fixture.count ? { count: fixture.count } : null, error: null };
        }),
      };
      return query;
    }),
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => makeClient()),
}));

const request = supertest(app);

beforeEach(() => {
  fixture.plan = "free";
  fixture.count = 0;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
});

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  vi.clearAllMocks();
});

describe("GET /api/subscription", () => {
  it("requires an authenticated Supabase bearer token", async () => {
    const response = await request.get("/api/subscription");
    expect(response.status).toBe(401);
  });

  it("returns a server-owned Pro quota and Japan pricing when Japan is selected", async () => {
    fixture.plan = "pro";
    fixture.count = 2;

    const response = await request
      .get("/api/subscription?region=japan&language=id")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      activePlan: "pro",
      dailyLimit: 50,
      usedToday: 2,
      remainingToday: 48,
      selectedRegion: "japan",
      billingAvailable: false,
    });
    expect(response.body.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "plus",
          dailyAiMessages: 20,
          prices: expect.objectContaining({
            japan: expect.objectContaining({ display: "¥980" }),
          }),
        }),
      ]),
    );
  });

  it("safely defaults users without an entitlement row to Free", async () => {
    fixture.plan = null;
    fixture.count = 0;

    const response = await request
      .get("/api/subscription?region=indonesia")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.activePlan).toBe("free");
    expect(response.body.dailyLimit).toBe(5);
    expect(response.body.remainingToday).toBe(5);
    expect(response.body.selectedRegion).toBe("indonesia");
  });

  it("defaults to Global pricing independently of the app language", async () => {
    const response = await request
      .get("/api/subscription?language=ja")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.selectedRegion).toBe("global");
    expect(response.body.plans[1].prices.global.display).toBe("$6.99");
  });
});