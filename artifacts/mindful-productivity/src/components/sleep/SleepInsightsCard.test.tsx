import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SleepInsightsCard } from "./SleepInsightsCard";

const fixture = vi.hoisted(() => ({
  setLocation: vi.fn(),
  hookOptions: undefined as unknown,
  result: {
    data: undefined as
      | undefined
      | {
          plan: "plus" | "pro";
          nightsTracked: number;
          averageQuality: number;
          averageEnergy: number;
          trend: "improving" | "steady" | "gentler_start";
        },
    isLoading: false,
    isError: false,
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/sleep", fixture.setLocation],
}));

vi.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) =>
      ({
        "sleep.insights.title": "Sleep Insights",
        "sleep.insights.locked": "Unlock insights with Plus",
        "sleep.insights.upgrade": "View Plans",
        "sleep.insights.nights": "Nights Tracked",
        "sleep.insights.avgQuality": "Avg Quality",
        "sleep.insights.avgEnergy": "Avg Energy",
        "sleep.insights.trend": "Trend",
        "sleep.insights.trend.improving": "Improving",
        "sleep.insights.comingSoon": "Coming soon",
        "sleep.pro.title": "Pro personalized routine",
        "sleep.pro.locked": "Upgrade to Pro",
        "sleep.loading": "Loading",
        "sleep.error": "Error",
      })[key] ?? key,
  }),
}));

vi.mock("@/hooks/useSleepAuthRequest", () => ({
  useSleepAuthRequest: () => ({
    enabled: true,
    request: { headers: { Authorization: "Bearer test-token" } },
  }),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetSleepInsightsQueryKey: () => ["/api/sleep/insights"],
  useGetSleepInsights: (options: unknown) => {
    fixture.hookOptions = options;
    return fixture.result;
  },
}));

beforeEach(() => {
  cleanup();
  fixture.setLocation.mockReset();
  fixture.hookOptions = undefined;
  fixture.result = { data: undefined, isLoading: false, isError: false };
});

describe("SleepInsightsCard", () => {
  it("keeps the premium request disabled for Free and links to plans", () => {
    render(<SleepInsightsCard plan="free" />);

    expect(fixture.hookOptions).toMatchObject({
      query: { enabled: false },
      request: { headers: { Authorization: "Bearer test-token" } },
    });
    expect(screen.getByTestId("sleep-insights-locked")).toBeTruthy();
    fireEvent.click(screen.getByTestId("sleep-insights-view-plans"));
    expect(fixture.setLocation).toHaveBeenCalledWith("/plans");
  });

  it("loads server insights for Plus while keeping the Pro routine locked", () => {
    fixture.result = {
      data: {
        plan: "plus",
        nightsTracked: 4,
        averageQuality: 3.5,
        averageEnergy: 3,
        trend: "improving",
      },
      isLoading: false,
      isError: false,
    };

    render(<SleepInsightsCard plan="plus" />);

    expect(fixture.hookOptions).toMatchObject({ query: { enabled: true } });
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByTestId("sleep-pro-locked")).toBeTruthy();
  });

  it("labels the unavailable Pro routine as coming soon", () => {
    fixture.result = {
      data: {
        plan: "pro",
        nightsTracked: 6,
        averageQuality: 4,
        averageEnergy: 4,
        trend: "steady",
      },
      isLoading: false,
      isError: false,
    };

    render(<SleepInsightsCard plan="pro" />);

    expect(screen.getByTestId("sleep-pro-coming-soon").textContent).toContain("Coming soon");
  });
});