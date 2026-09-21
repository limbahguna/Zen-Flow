import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const insert = vi.fn();
const from = vi.fn(() => ({ upsert, insert }));

vi.mock("./supabase", () => ({
  default: {
    from: (...args: unknown[]) => from(...args),
  },
}));

import {
  logSanitizedLessonProgressError,
  sanitizePostgrestError,
  saveLessonProgress,
} from "./lessons";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const UUID_LESSON = "22222222-2222-4222-8222-222222222222";
const LOCAL_LESSON = "local-proc-7";

function migrationSql(): string {
  const candidates = [
    resolve(process.cwd(), "docs/migrations/lesson_progress_local_ids.sql"),
    resolve(process.cwd(), "../../docs/migrations/lesson_progress_local_ids.sql"),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error("lesson_progress_local_ids.sql not found");
  }
  return readFileSync(path, "utf8");
}

describe("sanitizePostgrestError", () => {
  it("keeps only code, message, details, and hint", () => {
    expect(
      sanitizePostgrestError({
        code: "22P02",
        message: 'invalid input syntax for type uuid: "local-proc-7"',
        details: null,
        hint: null,
        access_token: "secret-token",
        Authorization: "Bearer secret",
      }),
    ).toEqual({
      code: "22P02",
      message: 'invalid input syntax for type uuid: "local-proc-7"',
      details: undefined,
      hint: undefined,
    });
  });

  it("does not stringify unknown objects that might contain secrets", () => {
    expect(sanitizePostgrestError({ headers: { Authorization: "Bearer x" } })).toEqual({
      code: undefined,
      message: undefined,
      details: undefined,
      hint: undefined,
    });
  });
});

describe("logSanitizedLessonProgressError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the sanitized payload in development", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logSanitizedLessonProgressError(
      { code: "42501", message: "new row violates row-level security policy for table \"lesson_progress\"" },
      true,
    );
    expect(errorSpy).toHaveBeenCalledWith("[lesson_progress]", {
      code: "42501",
      message: "new row violates row-level security policy for table \"lesson_progress\"",
      details: undefined,
      hint: undefined,
    });
  });

  it("does not log in production", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logSanitizedLessonProgressError({ code: "42501", message: "rls" }, false);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("saveLessonProgress", () => {
  beforeEach(() => {
    upsert.mockReset();
    insert.mockReset();
    from.mockClear();
    upsert.mockResolvedValue({ error: null });
    insert.mockResolvedValue({ error: null });
  });

  it("upserts Yes feedback for a UUID lesson id", async () => {
    await saveLessonProgress(USER_ID, UUID_LESSON, true);
    expect(from).toHaveBeenCalledWith("lesson_progress");
    expect(upsert).toHaveBeenCalledTimes(1);
    const [row, options] = upsert.mock.calls[0];
    expect(row).toEqual(
      expect.objectContaining({
        user_id: USER_ID,
        lesson_id: UUID_LESSON,
        helpful: true,
      }),
    );
    expect(row.read_at).toEqual(expect.any(String));
    expect(options).toEqual({ onConflict: "user_id,lesson_id" });
  });

  it("upserts No feedback for a bundled local-* lesson id", async () => {
    await saveLessonProgress(USER_ID, LOCAL_LESSON, false);
    const [row, options] = upsert.mock.calls[0];
    expect(row.lesson_id).toBe(LOCAL_LESSON);
    expect(row.helpful).toBe(false);
    expect(options).toEqual({ onConflict: "user_id,lesson_id" });
  });

  it("treats a second submit as the same upsert (duplicate/update)", async () => {
    await saveLessonProgress(USER_ID, LOCAL_LESSON, true);
    await saveLessonProgress(USER_ID, LOCAL_LESSON, false);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0].helpful).toBe(false);
    expect(upsert.mock.calls[1][1]).toEqual({ onConflict: "user_id,lesson_id" });
  });

  it("falls back to insert when upsert is not supported yet", async () => {
    upsert.mockResolvedValue({
      error: {
        code: "42P10",
        message: "there is no unique or exclusion constraint matching the ON CONFLICT specification",
      },
    });
    await saveLessonProgress(USER_ID, UUID_LESSON, true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        lesson_id: UUID_LESSON,
        helpful: true,
      }),
    );
  });

  it("throws a sanitized-shape Supabase/RLS error", async () => {
    const rlsError = {
      code: "42501",
      message: "new row violates row-level security policy for table \"lesson_progress\"",
      details: null,
      hint: null,
    };
    upsert.mockResolvedValue({ error: rlsError });
    await expect(saveLessonProgress(USER_ID, UUID_LESSON, true)).rejects.toEqual(rlsError);
  });
});

describe("lesson_progress_local_ids migration", () => {
  it("converts lesson_id to text and keeps the existing unique constraint and user_id FK", () => {
    const sql = migrationSql();
    expect(sql).toContain("ALTER TABLE public.lesson_progress DROP CONSTRAINT IF EXISTS lesson_progress_lesson_id_fkey");
    expect(sql).toContain("ALTER COLUMN lesson_id TYPE text USING lesson_id::text");
    expect(sql).toContain("lesson_progress_user_id_lesson_id_key");
    expect(sql).toContain("It keeps the primary key, user_id FK, existing UNIQUE, RLS policies, grants");
    expect(sql).not.toContain("CONSTRAINT lesson_progress_user_lesson_unique UNIQUE (user_id, lesson_id)");
    expect(sql).not.toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lesson_progress TO authenticated");
    expect(sql).not.toContain("service_role");
  });
});

describe("listLessonProgress", () => {
  it("is a user-scoped read of lesson_id, read_at, and helpful", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/lessons.ts"), "utf8");
    const body = source.slice(source.indexOf("export async function listLessonProgress"));
    expect(body).toContain('.from("lesson_progress")');
    expect(body).toContain('.eq("user_id", userId)');
    expect(body).toContain("lesson_id, read_at, helpful");
    expect(body).not.toContain(".upsert");
    expect(body).not.toContain(".insert");
  });
});
