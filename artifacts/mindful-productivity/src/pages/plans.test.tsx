import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";

const subscription = vi.hoisted(() => ({
  data: {
    activePlan: "plus" as const,
    dailyLimit: 20,
    usedToday: 4,
    remainingToday: 16,
    selectedRegion: "global" as const,
    billingAvailable: false,
    plans: [
      {
        id: "free" as const,
        dailyAiMessages: 5,
        featureIds: ["basic_ai_coach"],
        prices: {
          global: { currency: "USD", amount: 0, display: "$0" },
          indonesia: { currency: "IDR", amount: 0, display: "Rp0" },
          japan: { currency: "JPY", amount: 0, display: "¥0" },
        },
      },
      {
        id: "plus" as const,
        dailyAiMessages: 20,
        featureIds: ["ai_messages_20", "premium_content"],
        prices: {
          global: { currency: "USD", amount: 6.99, display: "$6.99" },
          indonesia: { currency: "IDR", amount: 69000, display: "Rp69.000" },
          japan: { currency: "JPY", amount: 980, display: "¥980" },
        },
      },
      {
        id: "pro" as const,
        dailyAiMessages: 50,
        featureIds: ["ai_messages_50"],
        prices: {
          global: { currency: "USD", amount: 9.99, display: "$9.99" },
          indonesia: { currency: "IDR", amount: 99000, display: "Rp99.000" },
          japan: { currency: "JPY", amount: 1480, display: "¥1,480" },
        },
      },
    ],
  },
}));
const observedRegions = vi.hoisted(() => [] as string[]);

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: (region: "global" | "indonesia" | "japan") => ({
    ...(() => {
      observedRegions.push(region);
      return {};
    })(),
    ...subscription,
    region,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/components/BottomNav", () => ({ BottomNav: () => <nav /> }));

import PlansPage from "./plans";

function LanguageSwitcher() {
  const { setLanguage } = useLanguage();
  return (
    <>
      <button type="button" data-testid="switch-to-ja" onClick={() => setLanguage("ja")}>
        Japanese
      </button>
      <button type="button" data-testid="switch-to-en" onClick={() => setLanguage("en")}>
        English
      </button>
    </>
  );
}

describe("PlansPage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    localStorage.clear();
    observedRegions.length = 0;
  });

  function mockDeviceTimeZone(timeZone: string) {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      calendar: "gregory",
      numberingSystem: "latn",
      timeZone,
    });
  }

  function renderPlans(language: "en" | "id" | "ja", withLanguageSwitcher = false) {
    localStorage.setItem("mindful_language", language);
    render(
      <LanguageProvider>
        <PlansPage />
        {withLanguageSwitcher && <LanguageSwitcher />}
      </LanguageProvider>,
    );
  }

  it("shows Indonesia prices for Indonesian language", () => {
    mockDeviceTimeZone("Asia/Jakarta");
    renderPlans("id");

    expect(screen.getByTestId("plan-card-plus").textContent).toContain("Rp69.000");
    expect(screen.getByTestId("plan-card-pro").textContent).toContain("Rp99.000");
    expect(screen.queryByTestId("pricing-region")).toBeNull();
  });

  it("shows Japan prices for Japanese language", () => {
    mockDeviceTimeZone("Asia/Tokyo");
    renderPlans("ja");

    expect(screen.getByTestId("plan-card-plus").textContent).toContain("¥980");
    expect(screen.getByTestId("plan-card-pro").textContent).toContain("¥1,480");
  });

  it("shows Global prices for English language", () => {
    mockDeviceTimeZone("UTC");
    renderPlans("en");

    expect(screen.getByTestId("plan-card-plus").textContent).toContain("$6.99");
    expect(screen.getByTestId("plan-card-pro").textContent).toContain("$9.99");
  });

  it("keeps Indonesian pricing when the UI language changes", () => {
    mockDeviceTimeZone("Asia/Jakarta");
    renderPlans("en", true);

    expect(screen.getByTestId("plan-card-plus").textContent).toContain("Rp69.000");
    fireEvent.click(screen.getByTestId("switch-to-ja"));

    expect(screen.getByTestId("plan-card-plus").textContent).toContain("Rp69.000");
    expect(observedRegions.length).toBeGreaterThan(0);
    expect(observedRegions.every((region) => region === "indonesia")).toBe(true);
  });

  it("keeps Japan pricing when the UI language changes", () => {
    mockDeviceTimeZone("Asia/Tokyo");
    renderPlans("id", true);

    expect(screen.getByTestId("plan-card-plus").textContent).toContain("¥980");
    fireEvent.click(screen.getByTestId("switch-to-en"));

    expect(screen.getByTestId("plan-card-plus").textContent).toContain("¥980");
    expect(observedRegions.length).toBeGreaterThan(0);
    expect(observedRegions.every((region) => region === "japan")).toBe(true);
  });
});