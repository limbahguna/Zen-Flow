import supabase from "../supabase";
import { logSanitizedWellnessError } from "./errors";
import type { WellnessProgramAbandonResult, WellnessProgramEnrollResult } from "./errors";
import type { EnrollmentStatus, ProgramEnrollment, ProgramSlug } from "./types";

export type { WellnessProgramAbandonResult, WellnessProgramEnrollResult } from "./errors";

export async function listRecentEnrollments(
  userId: string,
): Promise<ProgramEnrollment[]> {
  const { data, error } = await supabase
    .from("user_program_enrollments")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "completed"])
    .order("updated_at", { ascending: false });
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  return (data ?? []) as ProgramEnrollment[];
}

export function featuredEnrollment(
  enrollments: ProgramEnrollment[],
): ProgramEnrollment | null {
  return enrollments.find((row) => row.status === "active") ?? enrollments[0] ?? null;
}

export async function getActiveEnrollment(
  userId: string,
): Promise<ProgramEnrollment | null> {
  const { data, error } = await supabase
    .from("user_program_enrollments")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  return (data as ProgramEnrollment | null) ?? null;
}

/**
 * Direct table write — not production. Authenticated clients have no INSERT
 * on user_program_enrollments; use enrollWellnessProgram instead.
 */
export async function createEnrollment(input: {
  program_slug: ProgramSlug;
  started_on: string;
  current_day?: number;
}): Promise<ProgramEnrollment> {
  const { data, error } = await supabase
    .from("user_program_enrollments")
    .insert({
      program_slug: input.program_slug,
      started_on: input.started_on,
      status: "active",
      current_day: input.current_day ?? 1,
    })
    .select()
    .single();
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  return data as ProgramEnrollment;
}

/**
 * Production authority for creating an enrollment. Starts at day 1, active.
 * Not wired to UI in Phase 1C.
 */
export async function enrollWellnessProgram(
  programSlug: ProgramSlug,
): Promise<WellnessProgramEnrollResult> {
  const { data, error } = await supabase.rpc("enroll_wellness_program", {
    p_program_slug: programSlug,
  });
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Enrollment returned no result");
  }
  return row as WellnessProgramEnrollResult;
}

/**
 * Production authority for abandoning an active enrollment.
 * Not wired to UI in Phase 1B.
 */
export async function abandonWellnessProgram(
  enrollmentId: string,
): Promise<WellnessProgramAbandonResult> {
  const { data, error } = await supabase.rpc("abandon_wellness_program", {
    p_enrollment_id: enrollmentId,
  });
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Abandon enrollment returned no result");
  }
  return row as WellnessProgramAbandonResult;
}

/**
 * Direct table write — not production. Authenticated clients have no UPDATE
 * on user_program_enrollments; progression is completeWellnessDailyPlan.
 */
export async function updateEnrollmentProgress(
  enrollmentId: string,
  userId: string,
  progress: {
    current_day: number;
    status: EnrollmentStatus;
    completed_on: string | null;
  },
): Promise<ProgramEnrollment> {
  const { data, error } = await supabase
    .from("user_program_enrollments")
    .update(progress)
    .eq("id", enrollmentId)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) {
    logSanitizedWellnessError(error);
    throw error;
  }
  return data as ProgramEnrollment;
}
