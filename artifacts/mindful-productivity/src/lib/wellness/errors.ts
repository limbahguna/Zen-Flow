import type { EnrollmentStatus, ProgramSlug } from "./types";

export interface SanitizedWellnessError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function asTrimmedString(value: unknown, maxLength = 300): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

/** Safe PostgREST subset — never logs tokens, payloads, env, user ids, or reflections. */
export function sanitizeWellnessError(error: unknown): SanitizedWellnessError {
  if (!error || typeof error !== "object") {
    return { message: "unknown_error" };
  }
  const record = error as Record<string, unknown>;
  return {
    code: asTrimmedString(record.code, 40),
    message: asTrimmedString(record.message),
    details: asTrimmedString(record.details),
    hint: asTrimmedString(record.hint),
  };
}

export function logSanitizedWellnessError(error: unknown, isDev: boolean = import.meta.env.DEV): void {
  if (!isDev) return;
  console.error("[wellness]", sanitizeWellnessError(error));
}

export function isAnotherProgramActiveError(error: unknown): boolean {
  const message = sanitizeWellnessError(error).message ?? "";
  return /another program is already active/i.test(message);
}

export interface WellnessDailyPlanCompletion {
  plan_id: string;
  plan_completed: boolean;
  enrollment_id: string | null;
  program_slug: ProgramSlug | string | null;
  completed_program_day: number | null;
  current_program_day: number | null;
  enrollment_status: EnrollmentStatus | string | null;
  advanced: boolean;
}

export interface WellnessProgramEnrollResult {
  enrollment_id: string;
  program_slug: ProgramSlug | string;
  status: EnrollmentStatus | string;
  current_day: number;
  started_on: string;
  already_active: boolean;
}

export interface WellnessProgramAbandonResult {
  enrollment_id: string;
  status: EnrollmentStatus | string;
  already_abandoned: boolean;
}
