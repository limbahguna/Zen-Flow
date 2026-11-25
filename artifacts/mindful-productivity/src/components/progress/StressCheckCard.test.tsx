import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { LanguageProvider } from "@/context/LanguageContext";
import { StressCheckCard } from "./StressCheckCard";
import { StressTrend } from "./StressTrend";

function renderCard(ui: ReactNode) {
  localStorage.setItem("mindful_language", "en");
  return render(<LanguageProvider><Router>{ui}</Router></LanguageProvider>);
}

describe("Stress Check surfaces", () => {
  it("shows a loading state, then an empty estimate", () => {
    const { rerender } = renderCard(
      <StressCheckCard isLoading isError={false} today={null} threeDayElevated={false} onRetry={vi.fn()} />,
    );
    expect(screen.getByTestId("dashboard-stress-loading")).toBeTruthy();
    rerender(
      <LanguageProvider>
        <Router>
          <StressCheckCard isLoading={false} isError={false} today={null} threeDayElevated={false} onRetry={vi.fn()} />
        </Router>
      </LanguageProvider>,
    );
    expect(screen.getByTestId("dashboard-stress-empty").textContent).toContain("Not enough data yet");
    expect(screen.getByTestId("dashboard-stress-card").textContent).toContain("not a medical assessment");
  });

  it("shows the score and a link to an existing practice", async () => {
    const user = userEvent.setup();
    renderCard(
      <StressCheckCard
        isLoading={false}
        isError={false}
        threeDayElevated={false}
        onRetry={vi.fn()}
        today={{
          localDate: "2026-03-03",
          score: 62,
          level: "elevated",
          confidence: "medium",
          recommendationKeys: ["stress.recommend.breathing"],
        }}
      />,
    );
    expect(screen.getByTestId("dashboard-stress-score").textContent).toContain("62");
    await user.click(screen.getByTestId("dashboard-stress-action"));
    expect(window.location.pathname).toBe("/focus");
  });

  it("toggles the progress chart between 7 and 30 days", async () => {
    const user = userEvent.setup();
    const days = Array.from({ length: 30 }, (_, index) => ({
      localDate: `2026-03-${String(index + 1).padStart(2, "0")}`,
      score: index % 2 === 0 ? 40 : null,
      level: "mild" as const,
      confidence: "low" as const,
      recommendationKeys: [],
    }));
    renderCard(<StressTrend days={days} isLoading={false} isError={false} onRetry={vi.fn()} />);
    expect(screen.getByTestId("stress-trend-chart").children).toHaveLength(7);
    await user.click(screen.getByTestId("stress-range-30"));
    expect(screen.getByTestId("stress-trend-chart").children).toHaveLength(30);
  });
});
