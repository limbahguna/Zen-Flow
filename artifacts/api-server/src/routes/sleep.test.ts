import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import app from "../app";

const fixture = vi.hoisted(() => ({
  plan: "free" as "free" | "plus" | "pro",
  fromTables: [] as string[],
  upserts: [] as Array<{ table: string; value: Record<string, unknown> }>,
  insights: [
    { sleep_quality: 3, energy_level: 2, sleep_date: "2026-08-21" },
    { sleep_quality: 4, energy_level: 4, sleep_date: "2026-08-26" },
  ],
}));

function makeClient() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "authenticated-sleep-user" } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      fixture.fromTables.push(table);
      let inserted: Record<string, unknown> | null = null;
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        gte: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(async () => ({ data: [], error: null })),
        upsert: vi.fn((value: Record<string, unknown>) => {
          inserted = value;
          fixture.upserts.push({ table, value });
          return query;
        }),
        insert: vi.fn((value: Record<string, unknown>) => {
          inserted = value;
          return query;
        }),
        single: vi.fn(async () => ({
          data:
            table === "sleep_check_ins"
              ? {
                  id: "check-in-id",
                  ...(inserted ?? {}),
                  created_at: "2026-08-27T00:00:00.000Z",
                  updated_at: "2026-08-27T00:00:00.000Z",
                }
              : null,
          error: null,
        })),
        maybeSingle: vi.fn(async () => ({
          data: table === "user_entitlements" ? { plan: fixture.plan } : null,
          error: null,
        })),
        then: (resolve: (result: { data: typeof fixture.insights; error: null }) => unknown) =>
          resolve({
            data: table === "sleep_check_ins" ? fixture.insights : [],
            error: null,
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
  fixture.fromTables = [];
  fixture.upserts = [];
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
});

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  vi.clearAllMocks();
});

describe("Sleep Support API", () => {
  it("requires an authenticated bearer token", async () => {
    const response = await request.get("/api/sleep");
    expect(response.status).toBe(401);
  });

  it("uses the JWT user id instead of a user id supplied by the client", async () => {
    const response = await request
      .post("/api/sleep/check-ins")
      .set("Authorization", "Bearer valid-token")
      .send({
        userId: "another-user",
        sleepDate: "2026-08-27",
        sleepQuality: 4,
        energyLevel: 3,
        feeling: "rested",
      });

    expect(response.status).toBe(201);
    expect(fixture.upserts[0]).toMatchObject({
      table: "sleep_check_ins",
      value: { user_id: "authenticated-sleep-user" },
    });
    expect(fixture.upserts[0].value).not.toHaveProperty("userId");
    expect(response.body.userId).toBe("authenticated-sleep-user");
  });

  it("rejects Free insights before reading sleep data", async () => {
    const response = await request
      .get("/api/sleep/insights")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(403);
    expect(fixture.fromTables).toContain("user_entitlements");
    expect(fixture.fromTables).not.toContain("sleep_check_ins");
  });

  it("returns insights for Plus users", async () => {
    fixture.plan = "plus";
    const response = await request
      .get("/api/sleep/insights")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      plan: "plus",
      nightsTracked: 2,
      averageQuality: 3.5,
      averageEnergy: 3,
      trend: "improving",
    });
  });
});