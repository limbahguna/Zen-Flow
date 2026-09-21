import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PRICING_REGION, fetchSubscription, pricingRegionForDevice } from "./subscription";
import { resolveApiUrl } from "./apiBaseUrl";

describe("pricing region from device", () => {
  it.each([
    ["id", "UTC", "indonesia"],
    ["id-ID", "UTC", "indonesia"],
    ["en-US", "Asia/Jakarta", "indonesia"],
    ["en-US", "Asia/Makassar", "indonesia"],
    ["en-US", "Asia/Jayapura", "indonesia"],
    ["ja", "UTC", "japan"],
    ["ja-JP", "UTC", "japan"],
    ["en-US", "Asia/Tokyo", "japan"],
  ])("maps locale %s and timezone %s to %s pricing", (locale, timeZone, expectedRegion) => {
    expect(pricingRegionForDevice(locale, timeZone)).toBe(expectedRegion);
  });

  it("uses Global/USD for an unknown locale", () => {
    expect(pricingRegionForDevice("fr-FR", "UTC")).toBe(DEFAULT_PRICING_REGION);
  });
});

describe("subscription API URL", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the existing bearer token to the resolved subscription endpoint", async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        activePlan: "free",
        dailyLimit: 5,
        usedToday: 0,
        remainingToday: 5,
        selectedRegion: "global",
        billingAvailable: false,
        plans: [],
      }),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    await fetchSubscription("test-access-token", "japan");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/api/subscription?region=japan");
    expect(String(url)).not.toContain("/api/api/");
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer test-access-token",
    );
  });

  it("keeps the Android production subscription URL on the canonical origin", () => {
    expect(
      resolveApiUrl("/api/subscription?region=indonesia", {
        rawEnv: "",
        mode: "android",
        isDev: false,
        isNative: true,
      }),
    ).toBe("https://getmindfulspace.com/api/subscription?region=indonesia");
  });
});
