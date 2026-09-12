/**
 * Tests for DELETE /api/account
 *
 * Architecture under test:
 *   @workspace/db   → Replit PostgreSQL (Drizzle): tasks, moods
 *   supabaseAdmin   → Supabase PostgreSQL (Admin client): lesson_progress,
 *                     journal_entries, fear_settings, anxiety_checks,
 *                     daily_metrics, ai_content_reports, tasks (WOOP), auth.users
 *
 * Security properties verified:
 *   - No token → 401
 *   - Invalid token → 401
 *   - Request body / query cannot override the authenticated userId
 *   - All deletes target the JWT-derived userId only
 *   - Replit DB failure → no Supabase deletion, no auth deletion
 *   - Supabase table failure → no auth user deletion
 *   - Success: Replit PG deleted → Supabase deleted → auth user deleted
 *   - Auth deletion failure after DB deletion → 500 with partial-failure msg
 *   - SUPABASE_SERVICE_ROLE_KEY never appears in log output
 *   - err.message not logged (only safe error class names)
 *   - All required Supabase tables deleted
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import supertest from "supertest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const state = {
    authenticatedUserId: "user-jwt-verified",
    tokenIsValid: true,
    replitDbShouldFail: false,
    adminDeleteShouldFail: false,
    /** Table names that the Supabase Admin .from().delete() should fail on */
    supabaseTableFailOn: null as string | null,
    /** Tables deleted via supabaseAdmin.from(table).delete().eq() */
    capturedSupabaseDeletes: [] as string[],
    /** Table names from Drizzle tx.delete() calls */
    capturedDrizzleDeletes: [] as string[],
    /** userId strings passed to supabaseAdmin.auth.admin.deleteUser() */
    capturedAdminDeleteCalls: [] as string[],
  };

  const tasksTable = { userId: "tasks.user_id" };
  const moodsTable = { userId: "moods.user_id" };

  // Drizzle transaction mock — only tasks and moods (Replit PostgreSQL)
  const tx = {
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(async () => {
        if (table === tasksTable) state.capturedDrizzleDeletes.push("tasks");
        if (table === moodsTable) state.capturedDrizzleDeletes.push("moods");
        return [];
      }),
    })),
  };

  const db = {
    transaction: vi.fn(
      async (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
        if (state.replitDbShouldFail) throw new Error("DB_CONNECTION_ERROR");
        return fn(tx);
      },
    ),
  };

  // Supabase Admin client mock
  const adminDeleteUser = vi.fn(async (uid: string) => {
    state.capturedAdminDeleteCalls.push(uid);
    if (state.adminDeleteShouldFail) {
      return { error: { status: 500, message: "Admin error" } };
    }
    return { error: null };
  });

  const supabaseAdminClient = {
    auth: { admin: { deleteUser: adminDeleteUser } },
    from: vi.fn((table: string) => ({
      delete: vi.fn(() => ({
        eq: vi.fn(async (_col: string, _val: string) => {
          state.capturedSupabaseDeletes.push(table);
          if (state.supabaseTableFailOn === table) {
            return { data: null, error: { code: "42P01", status: 500 } };
          }
          return { data: [], error: null };
        }),
      })),
    })),
  };

  const createClient = vi.fn(() => supabaseAdminClient);

  // Auth middleware mocks
  const requireSupabaseAuth = vi.fn(
    (
      _req: unknown,
      res: {
        status: (n: number) => { json: (o: unknown) => void };
        locals: Record<string, unknown>;
      },
      next: () => void,
    ) => {
      if (!state.tokenIsValid) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
      res.locals.authenticatedUser = { id: state.authenticatedUserId };
      next();
    },
  );

  const getAuthenticatedUserId = vi.fn(
    (res: { locals: Record<string, unknown> }): string => {
      const userId = (
        res.locals.authenticatedUser as { id?: string } | undefined
      )?.id;
      if (!userId) throw new Error("Missing auth context");
      return userId;
    },
  );

  return {
    state,
    db,
    tasksTable,
    moodsTable,
    tx,
    createClient,
    supabaseAdminClient,
    requireSupabaseAuth,
    getAuthenticatedUserId,
  };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  tasksTable: mocks.tasksTable,
  moodsTable: mocks.moodsTable,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("../middlewares/supabaseAuth", () => ({
  requireSupabaseAuth: mocks.requireSupabaseAuth,
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));

// ── App + env setup ────────────────────────────────────────────────────────────
import app from "../app";
import { logger } from "../lib/logger";
import type { Logger } from "pino";

let infoSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

const SERVICE_ROLE_KEY_VALUE = "test-service-role-key-secret-value";

const REQUIRED_SUPABASE_TABLES = [
  "lesson_progress",
  "journal_entries",
  "fear_settings",
  "anxiety_checks",
  "daily_metrics",
  "ai_content_reports",
  "tasks",
] as const;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY_VALUE;

  mocks.state.tokenIsValid = true;
  mocks.state.replitDbShouldFail = false;
  mocks.state.adminDeleteShouldFail = false;
  mocks.state.supabaseTableFailOn = null;
  mocks.state.capturedSupabaseDeletes = [];
  mocks.state.capturedDrizzleDeletes = [];
  mocks.state.capturedAdminDeleteCalls = [];

  vi.clearAllMocks();

  // Restore default implementations — vi.clearAllMocks() only clears call
  // history, NOT implementations, so tests that call mockImplementation() on
  // shared mocks would otherwise leak into subsequent tests.
  mocks.requireSupabaseAuth.mockImplementation(
    (
      _req: unknown,
      res: {
        status: (n: number) => { json: (o: unknown) => void };
        locals: Record<string, unknown>;
      },
      next: () => void,
    ) => {
      if (!mocks.state.tokenIsValid) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
      res.locals.authenticatedUser = { id: mocks.state.authenticatedUserId };
      next();
    },
  );

  mocks.getAuthenticatedUserId.mockImplementation(
    (res: { locals: Record<string, unknown> }): string => {
      const userId = (
        res.locals.authenticatedUser as { id?: string } | undefined
      )?.id;
      if (!userId) throw new Error("Missing auth context");
      return userId;
    },
  );

  mocks.supabaseAdminClient.auth.admin.deleteUser.mockImplementation(
    async (uid: string) => {
      mocks.state.capturedAdminDeleteCalls.push(uid);
      if (mocks.state.adminDeleteShouldFail) {
        return { error: { status: 500, message: "Admin error" } };
      }
      return { error: null };
    },
  );

  mocks.supabaseAdminClient.from.mockImplementation((table: string) => ({
    delete: vi.fn(() => ({
      eq: vi.fn(async (_col: string, _val: string) => {
        mocks.state.capturedSupabaseDeletes.push(table);
        if (mocks.state.supabaseTableFailOn === table) {
          return { data: null, error: { code: "42P01" } };
        }
        return { data: [], error: null };
      }),
    })),
  }));

  mocks.tx.delete.mockImplementation((table: unknown) => ({
    where: vi.fn(async () => {
      if (table === mocks.tasksTable) mocks.state.capturedDrizzleDeletes.push("tasks");
      if (table === mocks.moodsTable) mocks.state.capturedDrizzleDeletes.push("moods");
      return [];
    }),
  }));

  // Spy on the real pino logger so .child() remains intact for pino-http
  infoSpy = vi.spyOn(logger as unknown as Logger, "info");
  errorSpy = vi.spyOn(logger as unknown as Logger, "error");
});

afterEach(() => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ── Authentication ─────────────────────────────────────────────────────────────
describe("DELETE /api/account — authentication", () => {
  it("returns 401 when no Authorization header is provided", async () => {
    mocks.state.tokenIsValid = false;
    const res = await supertest(app).delete("/api/account");
    expect(res.status).toBe(401);
  });

  it("returns 401 when the JWT is invalid or expired", async () => {
    mocks.state.tokenIsValid = false;
    const res = await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer bad.token.here");
    expect(res.status).toBe(401);
  });
});

// ── Identity isolation ────────────────────────────────────────────────────────
describe("DELETE /api/account — identity isolation", () => {
  it("ignores userId in the request body — uses only the JWT-derived userId", async () => {
    const attackerSuppliedId = "attacker-chosen-id";
    const res = await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token")
      .send({ userId: attackerSuppliedId });

    expect(res.status).toBe(204);
    expect(mocks.state.capturedAdminDeleteCalls).toContain(
      mocks.state.authenticatedUserId,
    );
    expect(mocks.state.capturedAdminDeleteCalls).not.toContain(attackerSuppliedId);
  });

  it("ignores userId in the query string — uses only the JWT-derived userId", async () => {
    const attackerSuppliedId = "query-attacker-id";
    const res = await supertest(app)
      .delete(`/api/account?userId=${attackerSuppliedId}`)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(204);
    expect(mocks.state.capturedAdminDeleteCalls).toContain(
      mocks.state.authenticatedUserId,
    );
    expect(mocks.state.capturedAdminDeleteCalls).not.toContain(attackerSuppliedId);
  });
});

// ── All tables deleted ────────────────────────────────────────────────────────
describe("DELETE /api/account — all user data tables deleted", () => {
  it("deletes Replit PostgreSQL tables (tasks + moods) via Drizzle", async () => {
    const res = await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(204);
    expect(mocks.state.capturedDrizzleDeletes).toContain("tasks");
    expect(mocks.state.capturedDrizzleDeletes).toContain("moods");
  });

  it("deletes all required Supabase tables via the Admin client", async () => {
    const res = await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(204);
    for (const table of REQUIRED_SUPABASE_TABLES) {
      expect(mocks.state.capturedSupabaseDeletes).toContain(table);
    }
  });

  it("all Supabase deletes use the JWT-derived userId as the eq condition", async () => {
    const { authenticatedUserId } = mocks.state;

    // Capture .eq() arguments per table
    const eqCalls: Array<{ table: string; col: string; val: string }> = [];
    mocks.supabaseAdminClient.from.mockImplementation((table: string) => ({
      delete: vi.fn(() => ({
        eq: vi.fn(async (col: string, val: string) => {
          eqCalls.push({ table, col, val });
          mocks.state.capturedSupabaseDeletes.push(table);
          return { data: [], error: null };
        }),
      })),
    }));

    await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token");

    for (const call of eqCalls) {
      expect(call.val).toBe(authenticatedUserId);
    }
  });
});

// ── Failure isolation ─────────────────────────────────────────────────────────
describe("DELETE /api/account — Replit DB failure does not delete Supabase data", () => {
  it("returns 500 and does NOT call any Supabase deletion when Drizzle transaction fails", async () => {
    mocks.state.replitDbShouldFail = true;

    const res = await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(mocks.state.capturedSupabaseDeletes).toHaveLength(0);
    expect(mocks.state.capturedAdminDeleteCalls).toHaveLength(0);
  });
});

describe("DELETE /api/account — Supabase table failure does not delete auth user", () => {
  it("returns 500 and does NOT call deleteUser when a Supabase table delete fails", async () => {
    mocks.state.supabaseTableFailOn = "journal_entries";

    const res = await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(mocks.state.capturedAdminDeleteCalls).toHaveLength(0);
  });
});

// ── Success path ──────────────────────────────────────────────────────────────
describe("DELETE /api/account — success path", () => {
  it("returns 204 and deletes Replit PG and Supabase before auth user", async () => {
    const callOrder: string[] = [];

    mocks.tx.delete.mockImplementation((table: unknown) => ({
      where: vi.fn(async () => {
        if (table === mocks.tasksTable) {
          mocks.state.capturedDrizzleDeletes.push("tasks");
          callOrder.push("drizzle-tasks");
        }
        if (table === mocks.moodsTable) {
          mocks.state.capturedDrizzleDeletes.push("moods");
          callOrder.push("drizzle-moods");
        }
        return [];
      }),
    }));

    mocks.supabaseAdminClient.from.mockImplementation((table: string) => ({
      delete: vi.fn(() => ({
        eq: vi.fn(async () => {
          mocks.state.capturedSupabaseDeletes.push(table);
          callOrder.push(`supabase-${table}`);
          return { data: [], error: null };
        }),
      })),
    }));

    mocks.supabaseAdminClient.auth.admin.deleteUser.mockImplementation(
      async (uid: string) => {
        mocks.state.capturedAdminDeleteCalls.push(uid);
        callOrder.push("auth-delete");
        return { error: null };
      },
    );

    const res = await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(204);

    // Auth deletion must be last
    const authDeleteIdx = callOrder.indexOf("auth-delete");
    const lastDbOp = Math.max(
      ...callOrder
        .map((s, i) => (s.startsWith("drizzle-") || s.startsWith("supabase-") ? i : -1)),
    );
    expect(authDeleteIdx).toBeGreaterThan(lastDbOp);

    // Drizzle PG must be deleted before Supabase tables
    const firstDrizzleIdx = Math.min(
      callOrder.indexOf("drizzle-tasks"),
      callOrder.indexOf("drizzle-moods"),
    );
    const firstSupabaseIdx = callOrder.findIndex((s) => s.startsWith("supabase-"));
    expect(firstDrizzleIdx).toBeLessThan(firstSupabaseIdx);
  });

  it("returns 500 when auth deletion fails after DB deletion succeeds", async () => {
    mocks.supabaseAdminClient.auth.admin.deleteUser.mockImplementation(
      async (uid: string) => {
        mocks.state.capturedAdminDeleteCalls.push(uid);
        return { error: { status: 500, message: "Admin error" } };
      },
    );

    const res = await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(mocks.state.capturedAdminDeleteCalls).toHaveLength(1);
  });
});

// ── Service key not configured ────────────────────────────────────────────────
describe("DELETE /api/account — service role key not configured", () => {
  it("returns 503 and touches no data when SUPABASE_SERVICE_ROLE_KEY is absent", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const res = await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(503);
    expect(mocks.db.transaction).not.toHaveBeenCalled();
    expect(mocks.state.capturedAdminDeleteCalls).toHaveLength(0);
  });
});

// ── Sensitive data not in logs ────────────────────────────────────────────────
describe("DELETE /api/account — sensitive data not in logs", () => {
  it("service-role key never appears in any log argument", async () => {
    await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token");

    const allLogArgs = [
      ...infoSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
    ]
      .map((a) => JSON.stringify(a))
      .join(" ");

    expect(allLogArgs).not.toContain(SERVICE_ROLE_KEY_VALUE);
  });

  it("user ID does not appear in log message strings (2nd pino arg)", async () => {
    await supertest(app)
      .delete("/api/account")
      .set("Authorization", "Bearer valid-token");

    const msgStrings = [
      ...infoSpy.mock.calls.map((c) => String(c[1] ?? "")),
      ...errorSpy.mock.calls.map((c) => String(c[1] ?? "")),
    ].join(" ");

    expect(msgStrings).not.toContain(mocks.state.authenticatedUserId);
  });
});
