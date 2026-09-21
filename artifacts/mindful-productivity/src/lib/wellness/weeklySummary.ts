import { t, type LanguageCode } from "../translations";
import { getProgram } from "./programCatalog";
import type { WeeklyProgressReport } from "./weeklyProgress";

export function weeklySummaryLines(language: LanguageCode, report: WeeklyProgressReport): string[] {
  const lines: string[] = [];

  if (report.plansCreated === 0) {
    lines.push(t(language, "progress.summary.noPlans"));
  } else {
    lines.push(t(language, "progress.summary.completedPlans", { count: report.plansCompleted }));
  }

  if (report.requiredRate != null) {
    lines.push(
      t(language, "progress.summary.required", {
        percent: Math.round(report.requiredRate * 100),
      }),
    );
  }

  if (report.consistencyLead === "practice") {
    lines.push(t(language, "progress.summary.practiceLead"));
  } else if (report.consistencyLead === "insight") {
    lines.push(t(language, "progress.summary.insightLead"));
  } else if (report.consistencyLead === "mood") {
    lines.push(t(language, "progress.summary.moodLead"));
  }

  if (report.moodDirection === "none") {
    lines.push(t(language, "progress.summary.moodNone"));
  } else if (report.moodDirection === "higher") {
    lines.push(t(language, "progress.summary.moodHigher"));
  } else if (report.moodDirection === "steady") {
    lines.push(t(language, "progress.summary.moodSteady"));
  } else {
    lines.push(t(language, "progress.summary.moodLower"));
  }

  if (report.programSlug && report.programDay != null && report.programDuration != null) {
    const programName = t(language, getProgram(report.programSlug).titleKey);
    if (report.programCompleted) {
      lines.push(t(language, "progress.summary.programDone", { program: programName }));
    } else {
      lines.push(
        t(language, "progress.summary.program", {
          day: report.programDay,
          total: report.programDuration,
          program: programName,
        }),
      );
    }
  }

  if (report.streak > 0) {
    lines.push(t(language, "progress.summary.streak", { count: report.streak }));
  }

  if (report.plansCompleted < 3) {
    lines.push(t(language, "progress.summary.encourage"));
  }

  return lines;
}

export function weeklySummaryText(language: LanguageCode, report: WeeklyProgressReport): string {
  return weeklySummaryLines(language, report).join(" ");
}

export function shareSummaryText(language: LanguageCode, report: WeeklyProgressReport): string {
  return [
    t(language, "progress.share.title"),
    `${report.start} – ${report.end}`,
    ...weeklySummaryLines(language, report),
  ].join("\n");
}

export function sharePayloadIsPrivateSafe(text: string): boolean {
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)) return false;
  if (/@/.test(text)) return false;
  if (/access_token|service_role|supabase/i.test(text)) return false;
  return true;
}
