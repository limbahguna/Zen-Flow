import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../supabase", () => ({
  default: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: vi.fn(),
  },
}));

import { completeWellnessDailyPlan } from "./dailyPlans";
import { isAnotherProgramActiveError, sanitizeWellnessError } from "./errors";
import { abandonWellnessProgram, enrollWellnessProgram } from "./programEnrollments";

describe("completeWellnessDailyPlan", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("calls complete_wellness_daily_plan with only p_plan_id", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          plan_id: "plan-1",
          plan_completed: true,
          enrollment_id: "enroll-1",
          program_slug: "calm-reset",
          completed_program_day: 1,
          current_program_day: 2,
          enrollment_status: "active",
          advanced: true,
        },
      ],
      error: null,
    });

    const result = await completeWellnessDailyPlan("plan-1");
    expect(rpc).toHaveBeenCalledWith("complete_wellness_daily_plan", { p_plan_id: "plan-1" });
    expect(result.advanced).toBe(true);
    expect(result.current_program_day).toBe(2);
  });
});

describe("enrollWellnessProgram", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("calls enroll_wellness_program with only p_program_slug", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          enrollment_id: "enroll-1",
          program_slug: "calm-reset",
          status: "active",
          current_day: 1,
          started_on: "2026-09-20",
          already_active: false,
        },
      ],
      error: null,
    });

    const result = await enrollWellnessProgram("calm-reset");
    expect(rpc).toHaveBeenCalledWith("enroll_wellness_program", {
      p_program_slug: "calm-reset",
    });
    expect(result.current_day).toBe(1);
    expect(result.status).toBe("active");
    expect(result.already_active).toBe(false);
  });
});

describe("abandonWellnessProgram", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("calls abandon_wellness_program with only p_enrollment_id", async () => {
    rpc.mockResolvedValue({
      data: [{ enrollment_id: "enroll-1", status: "abandoned", already_abandoned: false }],
      error: null,
    });

    const result = await abandonWellnessProgram("enroll-1");
    expect(rpc).toHaveBeenCalledWith("abandon_wellness_program", {
      p_enrollment_id: "enroll-1",
    });
    expect(result.status).toBe("abandoned");
  });
});

describe("sanitizeWellnessError", () => {
  it("does not keep tokens, payloads, env, user ids, or reflections", () => {
    expect(
      sanitizeWellnessError({
        code: "PGRST301",
        message: "permission denied",
        details: "RLS",
        hint: "check grants",
        headers: { Authorization: "Bearer secret" },
        user_id: "11111111-1111-4111-8111-111111111111",
        reflection_text: "private journal",
        env: { SUPABASE_KEY: "x" },
      }),
    ).toEqual({
      code: "PGRST301",
      message: "permission denied",
      details: "RLS",
      hint: "check grants",
    });
  });

  it("detects another-program-active RPC errors without leaking payloads", () => {
    expect(isAnotherProgramActiveError({ message: "Another program is already active" })).toBe(
      true,
    );
    expect(isAnotherProgramActiveError({ message: "permission denied" })).toBe(false);
  });
});
