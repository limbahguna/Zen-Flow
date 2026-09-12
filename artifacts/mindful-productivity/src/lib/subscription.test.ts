import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING_REGION, pricingRegionForDevice } from "./subscription";

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