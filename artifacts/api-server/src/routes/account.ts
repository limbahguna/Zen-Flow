import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { db, tasksTable, moodsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getAuthenticatedUserId,
  requireSupabaseAuth,
} from "../middlewares/supabaseAuth";
import { logger } from "../lib/logger";

const router = Router();

router.use("/account", requireSupabaseAuth);

/**
 * DELETE /account
 *
 * Permanently deletes all data for the authenticated user and removes their
 * Supabase Auth record.  The user ID is taken exclusively from the verified
 * JWT — never from the request body or query string.
 *
 * Architecture note — two separate databases:
 *   • @workspace/db  →  Replit PostgreSQL (Drizzle-managed)
 *   • Supabase Admin →  Supabase PostgreSQL (RLS-bypassing service-role client)
 *
 * Deletion order:
 *   Step 1 — Replit PostgreSQL (Drizzle transaction)
 *     - tasks (Drizzle schema)
 *     - moods
 *
 *   Step 2 — Supabase PostgreSQL (Admin client, FK-safe order)
 *     - lesson_progress   (may reference tasks)
 *     - journal_entries   (references tasks via task_id)
 *     - fear_settings     (references tasks via task_id)
 *     - anxiety_checks    (references tasks via task_id)
 *     - daily_metrics     (standalone aggregate)
 *     - tasks             (Supabase WOOP tasks — deleted after dependents)
 *     Note: coach_usage and user_entitlements auto-cascade when auth.users is deleted.
 *
 *   Step 3 — Delete auth.users (Supabase Admin API)
 *     Triggers coach_usage and user_entitlements ON DELETE CASCADE.
 *
 * Failure contract:
 *   If Step 1 fails → abort; auth record and all Supabase data preserved.
 *   If Step 2 fails → abort; auth record preserved; Replit PG already cleared.
 *   If Step 3 fails → partial failure logged for manual cleanup; 500 returned.
 *
 * Logging contract:
 *   Only stage, status, and safe error codes (HTTP status or error class name)
 *   are logged.  User ID, email, JWT, request body, and credential values are
 *   never logged.
 */
router.delete("/account", async (_req, res) => {
  const userId = getAuthenticatedUserId(res);

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    logger.error(
      { stage: "account-delete", status: "misconfigured" },
      "SUPABASE_SERVICE_ROLE_KEY is not configured",
    );
    res.status(503).json({ error: "Account deletion is not available" });
    return;
  }

  // ── Step 1: Replit PostgreSQL — Drizzle transaction ───────────────────────
  try {
    await db.transaction(async (tx) => {
      await tx.delete(tasksTable).where(eq(tasksTable.userId, userId));
      await tx.delete(moodsTable).where(eq(moodsTable.userId, userId));
    });
  } catch (err) {
    const errorCode = err instanceof Error ? err.constructor.name : "UnknownError";
    logger.error(
      { stage: "account-delete-replit-db", errorCode },
      "Replit DB transaction failed; all data preserved",
    );
    res.status(500).json({ error: "Account deletion failed" });
    return;
  }

  logger.info(
    { stage: "account-delete-replit-db", status: "success" },
    "Replit PostgreSQL data deleted",
  );

  // ── Step 2: Supabase PostgreSQL — Admin client (bypasses RLS) ────────────
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Tables deleted in FK-safe order (dependents before their parents).
  // coach_usage auto-cascades when auth.users is deleted (Step 3).
  const supabaseTables = [
    "lesson_progress",
    "journal_entries",
    "fear_settings",
    "anxiety_checks",
    "daily_metrics",
    "ai_content_reports",
    "sleep_routine_sessions",
    "sleep_journal_entries",
    "sleep_check_ins",
    "tasks",
  ] as const;

  for (const table of supabaseTables) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("user_id", userId);

    if (error) {
      const errorCode = error.code ?? "unknown";
      logger.error(
        { stage: "account-delete-supabase-db", table, errorCode },
        "Supabase table deletion failed; auth record preserved",
      );
      res.status(500).json({ error: "Account deletion failed" });
      return;
    }
  }

  logger.info(
    { stage: "account-delete-supabase-db", status: "success" },
    "Supabase PostgreSQL data deleted",
  );

  // ── Step 3: Delete Supabase Auth user (triggers coach_usage CASCADE) ──────
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      const errorCode = error.status ?? "unknown";
      logger.error(
        { stage: "account-delete-auth", errorCode },
        "Auth deletion failed after DB deletion — manual cleanup needed",
      );
      res.status(500).json({
        error:
          "Partial failure: data deleted but authentication record could not be removed. Contact support.",
      });
      return;
    }
  } catch (err) {
    const errorCode = err instanceof Error ? err.constructor.name : "UnknownError";
    logger.error(
      { stage: "account-delete-auth", errorCode },
      "Auth deletion threw after DB deletion — manual cleanup needed",
    );
    res.status(500).json({ error: "Account deletion partial failure" });
    return;
  }

  logger.info(
    { stage: "account-delete", status: "complete" },
    "Account and all associated data deleted",
  );
  res.status(204).send();
});

export default router;
