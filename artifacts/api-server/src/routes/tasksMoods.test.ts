import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import { logger } from "../lib/logger";

const mocks = vi.hoisted(() => {
  type Row = Record<string, unknown>;

  const state = {
    authenticatedUserId: "user-from-verified-jwt",
    tokenIsValid: true,
    taskRows: [] as Row[],
    moodRows: [] as Row[],
    updateRows: [] as Row[],
    deleteRows: [] as Row[],
    selectConditions: [] as unknown[],
    updateConditions: [] as unknown[],
    deleteConditions: [] as unknown[],
    inserts: [] as Array<{ table: unknown; values: Row }>,
  };

  const tasksTable = {
    id: "tasks.id",
    userId: "tasks.user_id",
    title: "tasks.title",
    description: "tasks.description",
    status: "tasks.status",
    priority: "tasks.priority",
    dueDate: "tasks.due_date",
    createdAt: "tasks.created_at",
  };
  const moodsTable = {
    id: "moods.id",
    userId: "moods.user_id",
    mood: "moods.mood",
    score: "moods.score",
    note: "moods.note",
    createdAt: "moods.created_at",
  };

  const makeAwaitable = (rows: Row[]) => {
    const promise = Promise.resolve(rows);
    return {
      orderBy: vi.fn(() => promise),
      then: promise.then.bind(promise),
    };
  };

  const db = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn((condition: unknown) => {
          state.selectConditions.push(condition);
          return makeAwaitable(table === tasksTable ? state.taskRows : state.moodRows);
        }),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: Row) => {
        state.inserts.push({ table, values });
        return {
          returning: vi.fn(async () => [
            { ...values, createdAt: new Date("2026-01-01T00:00:00.000Z") },
          ]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn((condition: unknown) => {
          state.updateConditions.push(condition);
          return { returning: vi.fn(async () => state.updateRows) };
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn((condition: unknown) => {
        state.deleteConditions.push(condition);
        return { returning: vi.fn(async () => state.deleteRows) };
      }),
    })),
  };

  return { db, moodsTable, state, tasksTable };
});

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  tasksTable: mocks.tasksTable,
  moodsTable: mocks.moodsTable,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: string, value: string) => ({ kind: "eq", column, value })),
  and: vi.fn((...conditions: unknown[]) => ({ kind: "and", conditions })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () =>
        mocks.state.tokenIsValid
          ? { data: { user: { id: mocks.state.authenticatedUserId } }, error: null }
          : { data: { user: null }, error: { message: "invalid token" } },
      ),
    },
  })),
}));

import app from "../app";

const request = supertest(app);
const validAuth = { Authorization: "Bearer test-access-token" };

function resetState() {
  mocks.state.authenticatedUserId = "user-from-verified-jwt";
  mocks.state.tokenIsValid = true;
  mocks.state.taskRows = [];
  mocks.state.moodRows = [];
  mocks.state.updateRows = [];
  mocks.state.deleteRows = [];
  mocks.state.selectConditions = [];
  mocks.state.updateConditions = [];
  mocks.state.deleteConditions = [];
  mocks.state.inserts = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  resetState();
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
});

afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
});

describe("tasks and moods authentication", () => {
  it.each([
    ["get", "/api/tasks", undefined],
    ["post", "/api/tasks", { title: "Task", status: "pending", priority: "medium" }],
    ["patch", "/api/tasks/task-1", { status: "completed" }],
    ["delete", "/api/tasks/task-1", undefined],
    ["get", "/api/tasks/summary", undefined],
    ["get", "/api/moods", undefined],
    ["post", "/api/moods", { mood: "good", score: 4, note: "Private note" }],
  ] as const)("rejects %s %s without a token before the database is called", async (method, path, body) => {
    let call = request[method](path);
    if (body) call = call.send(body);

    const response = await call;

    expect(response.status).toBe(401);
    expect(mocks.db.select).not.toHaveBeenCalled();
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });

  it("rejects a malformed Bearer header before the database is called", async () => {
    const response = await request
      .get("/api/tasks")
      .set("Authorization", "Token test-access-token");

    expect(response.status).toBe(401);
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("rejects an invalid token before the database is called", async () => {
    mocks.state.tokenIsValid = false;

    const response = await request
      .get("/api/tasks")
      .set("Authorization", "Bearer expired-token");

    expect(response.status).toBe(401);
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("returns 503 when server-side Supabase authentication configuration is unavailable", async () => {
    delete process.env.SUPABASE_URL;

    const response = await request.get("/api/tasks").set(validAuth);

    expect(response.status).toBe(503);
    expect(mocks.db.select).not.toHaveBeenCalled();
  });

  it("keeps /api/healthz public without a Bearer token", async () => {
    const response = await request.get("/api/healthz");

    expect(response.status).toBe(200);
  });
});

describe("tasks and moods ownership", () => {
  it("ignores a forged query userId and filters task reads by the verified JWT user", async () => {
    const response = await request
      .get("/api/tasks?userId=another-user")
      .set(validAuth);

    expect(response.status).toBe(200);
    expect(mocks.state.selectConditions).toContainEqual({
      kind: "and",
      conditions: [
        { kind: "eq", column: "tasks.user_id", value: "user-from-verified-jwt" },
      ],
    });
  });

  it("uses only the verified JWT user ID when creating a task or mood", async () => {
    const taskResponse = await request
      .post("/api/tasks")
      .set(validAuth)
      .send({
        userId: "another-user",
        title: "Task from the verified user",
        status: "pending",
        priority: "medium",
      });
    const moodResponse = await request
      .post("/api/moods")
      .set(validAuth)
      .send({
        userId: "another-user",
        mood: "good",
        score: 4,
        note: "Personal mood note",
      });

    expect(taskResponse.status).toBe(201);
    expect(moodResponse.status).toBe(201);
    expect(mocks.state.inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          values: expect.objectContaining({ userId: "user-from-verified-jwt" }),
        }),
      ]),
    );
    expect(mocks.state.inserts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          values: expect.objectContaining({ userId: "another-user" }),
        }),
      ]),
    );
  });

  it("returns the same 404 for a task owned by another user and includes id plus user_id in SQL update", async () => {
    const response = await request
      .patch("/api/tasks/task-owned-by-someone-else")
      .set(validAuth)
      .send({ status: "completed" });

    expect(response.status).toBe(404);
    expect(mocks.state.updateConditions).toContainEqual({
      kind: "and",
      conditions: [
        { kind: "eq", column: "tasks.id", value: "task-owned-by-someone-else" },
        { kind: "eq", column: "tasks.user_id", value: "user-from-verified-jwt" },
      ],
    });
  });

  it("returns the same 404 for a task owned by another user and includes id plus user_id in SQL delete", async () => {
    const response = await request
      .delete("/api/tasks/task-owned-by-someone-else")
      .set(validAuth);

    expect(response.status).toBe(404);
    expect(mocks.state.deleteConditions).toContainEqual({
      kind: "and",
      conditions: [
        { kind: "eq", column: "tasks.id", value: "task-owned-by-someone-else" },
        { kind: "eq", column: "tasks.user_id", value: "user-from-verified-jwt" },
      ],
    });
  });
});

describe("tasks and moods logging safety", () => {
  it("does not echo tokens, user IDs, task titles, or mood notes in authentication error responses", async () => {
    mocks.state.tokenIsValid = false;

    const response = await request
      .post("/api/tasks")
      .set("Authorization", "Bearer sensitive-access-token")
      .send({
        userId: "sensitive-user-id",
        title: "sensitive-task-title",
        status: "pending",
        priority: "medium",
        description: "sensitive-mood-note",
      });

    expect(response.status).toBe(401);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain("sensitive-access-token");
    expect(body).not.toContain("sensitive-user-id");
    expect(body).not.toContain("sensitive-task-title");
    expect(body).not.toContain("sensitive-mood-note");
  });

  it("does not send token, full user ID, task title, or mood note to warn/error logs", async () => {
    const warnSpy = vi.spyOn(logger, "warn");
    const errorSpy = vi.spyOn(logger, "error");
    mocks.state.authenticatedUserId = "sensitive-user-id";

    const response = await request
      .post("/api/moods")
      .set("Authorization", "Bearer sensitive-access-token")
      .send({ mood: "good", score: 4, note: "sensitive-mood-note" });

    expect(response.status).toBe(201);
    const logs = JSON.stringify([...warnSpy.mock.calls, ...errorSpy.mock.calls]);
    expect(logs).not.toContain("sensitive-access-token");
    expect(logs).not.toContain("sensitive-user-id");
    expect(logs).not.toContain("sensitive-mood-note");

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});