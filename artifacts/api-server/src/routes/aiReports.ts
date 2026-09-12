import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId, requireSupabaseAuth } from "../middlewares/supabaseAuth";
import { logger } from "../lib/logger";
import { verifyReportableResponseToken } from "../lib/reportToken";

const router = Router();

const MAX_NOTE_LENGTH = 500;
const REPORT_CATEGORIES = [
  "harmful_or_unsafe",
  "offensive_or_discriminatory",
  "incorrect_or_misleading",
  "other",
] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReportCategory = (typeof REPORT_CATEGORIES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeErrorCode(error: unknown): string {
  if (isRecord(error) && typeof error.code === "string") return error.code;
  return "unknown";
}

router.use("/ai/reports", requireSupabaseAuth);

router.post("/ai/reports", async (req, res) => {
  const userId = getAuthenticatedUserId(res);
  const body = isRecord(req.body) ? req.body : {};

  const category = body.category;
  const optionalNote = body.optionalNote;
  const reportClientId = body.reportClientId;
  const reportToken = body.reportToken;

  if (
    typeof category !== "string" ||
    !(REPORT_CATEGORIES as readonly string[]).includes(category) ||
    (optionalNote !== undefined &&
      optionalNote !== null &&
      (typeof optionalNote !== "string" || optionalNote.length > MAX_NOTE_LENGTH)) ||
    typeof reportClientId !== "string" ||
    !UUID_PATTERN.test(reportClientId) ||
    typeof reportToken !== "string"
  ) {
    res.status(400).json({ error: "Invalid report payload" });
    return;
  }

  const verifiedResponse = verifyReportableResponseToken(reportToken, userId);
  if (!verifiedResponse) {
    res.status(400).json({ error: "Invalid report payload" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    logger.error(
      { status: "misconfigured", category },
      "AI report service is not configured",
    );
    res.status(503).json({ error: "Reporting is not available" });
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: result, error: saveError } = await supabaseAdmin.rpc(
    "submit_ai_content_report",
    {
      p_user_id: userId,
      p_report_client_id: reportClientId,
      p_coach_response_id: verifiedResponse.responseId,
      p_category: category as ReportCategory,
      p_assistant_response: verifiedResponse.assistantResponse,
      p_optional_note:
        optionalNote === null || optionalNote === undefined || optionalNote === ""
          ? null
          : optionalNote,
      p_language: verifiedResponse.language,
    },
  );

  if (saveError) {
    logger.error(
      { status: "save-failed", category, errorCode: safeErrorCode(saveError) },
      "AI report save failed",
    );
    res.status(503).json({ error: "Reporting is temporarily unavailable" });
    return;
  }

  if (result === "daily_limit") {
    logger.warn({ status: "daily-limit", category }, "AI report daily limit reached");
    res.status(429).json({ error: "Daily report limit reached" });
    return;
  }

  if (result === "duplicate") {
    logger.warn({ status: "duplicate", category }, "AI report duplicate rejected");
    res.status(409).json({ error: "This response has already been reported" });
    return;
  }

  if (result !== "accepted") {
    logger.error({ status: "unexpected-result", category }, "AI report save returned an unexpected result");
    res.status(503).json({ error: "Reporting is temporarily unavailable" });
    return;
  }

  logger.info({ status: "accepted", category }, "AI report accepted for review");
  // Do not return the report or any user-provided content.
  res.status(204).send();
});

export default router;