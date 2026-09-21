import { describe, expect, it } from "vitest";
import {
  CANONICAL_PRODUCTION_API_ORIGIN,
  apiPath,
  assertHttpsApiOrigin,
  joinApiOriginAndPath,
  normalizeApiOrigin,
  resolveApiOrigin,
  resolveApiUrl,
  resolveBuildTimeApiBaseUrl,
} from "./apiBaseUrl";

describe("API origin normalization", () => {
  it("uses the canonical production origin without a path", () => {
    expect(normalizeApiOrigin("https://getmindfulspace.com")).toBe(
      CANONICAL_PRODUCTION_API_ORIGIN,
    );
    expect(normalizeApiOrigin("https://getmindfulspace.com/")).toBe(
      CANONICAL_PRODUCTION_API_ORIGIN,
    );
    expect(normalizeApiOrigin("https://getmindfulspace.com/api")).toBe(
      CANONICAL_PRODUCTION_API_ORIGIN,
    );
    expect(normalizeApiOrigin("https://getmindfulspace.com/api/")).toBe(
      CANONICAL_PRODUCTION_API_ORIGIN,
    );
  });

  it("does not duplicate /api when joining paths", () => {
    expect(apiPath("/api/subscription")).toBe("/api/subscription");
    expect(apiPath("subscription")).toBe("/api/subscription");
    expect(
      joinApiOriginAndPath(CANONICAL_PRODUCTION_API_ORIGIN, "/api/ai/coach"),
    ).toBe("https://getmindfulspace.com/api/ai/coach");
    expect(
      joinApiOriginAndPath("https://getmindfulspace.com/api", "/api/healthz"),
    ).toBe("https://getmindfulspace.com/api/healthz");
  });
});

describe("runtime API origin", () => {
  it("keeps localhost only for explicit local development", () => {
    expect(
      resolveApiOrigin({
        rawEnv: "http://localhost:8080",
        mode: "development",
        isDev: true,
        isNative: false,
      }),
    ).toBe("http://localhost:8080");
  });

  it("keeps same-origin browser production when the env is empty or local", () => {
    expect(
      resolveApiOrigin({
        rawEnv: "",
        mode: "production",
        isDev: false,
        isNative: false,
      }),
    ).toBe("");
    expect(
      resolveApiOrigin({
        rawEnv: "http://localhost:8080",
        mode: "production",
        isDev: false,
        isNative: false,
      }),
    ).toBe("");
  });

  it("uses the canonical origin for Capacitor Android production even if env is missing or local", () => {
    expect(
      resolveApiOrigin({
        rawEnv: "",
        mode: "android",
        isDev: false,
        isNative: true,
      }),
    ).toBe(CANONICAL_PRODUCTION_API_ORIGIN);
    expect(
      resolveApiOrigin({
        rawEnv: "http://localhost:8080",
        mode: "production",
        isDev: false,
        isNative: true,
      }),
    ).toBe(CANONICAL_PRODUCTION_API_ORIGIN);
  });

  it("allows localhost during native development live-reload", () => {
    expect(
      resolveApiOrigin({
        rawEnv: "http://localhost:8080",
        mode: "development",
        isDev: true,
        isNative: true,
      }),
    ).toBe("http://localhost:8080");
  });
});

describe("build-time API origin", () => {
  it("forces Android production onto the canonical HTTPS origin", () => {
    expect(
      resolveBuildTimeApiBaseUrl({
        command: "build",
        mode: "android",
        envValue: "http://localhost:8080",
      }),
    ).toBe(CANONICAL_PRODUCTION_API_ORIGIN);
    expect(
      resolveBuildTimeApiBaseUrl({
        command: "build",
        mode: "android",
        envValue: "",
      }),
    ).toBe(CANONICAL_PRODUCTION_API_ORIGIN);
    expect(
      resolveBuildTimeApiBaseUrl({
        command: "build",
        mode: "android",
        envValue: "https://getmindfulspace.com/api",
      }),
    ).toBe(CANONICAL_PRODUCTION_API_ORIGIN);
  });

  it("does not bake localhost into browser production builds", () => {
    expect(
      resolveBuildTimeApiBaseUrl({
        command: "build",
        mode: "production",
        envValue: "http://localhost:8080",
      }),
    ).toBe("");
  });

  it("preserves localhost for the local Vite dev server", () => {
    expect(
      resolveBuildTimeApiBaseUrl({
        command: "serve",
        mode: "development",
        envValue: "http://localhost:8080",
      }),
    ).toBe("http://localhost:8080");
  });
});

describe("production HTTPS handling", () => {
  it("rejects a non-HTTPS origin", () => {
    expect(() => assertHttpsApiOrigin("http://localhost:8080")).toThrow(
      /must use HTTPS/i,
    );
    expect(() => assertHttpsApiOrigin(CANONICAL_PRODUCTION_API_ORIGIN)).not.toThrow();
  });
});

describe("feature API URL resolution", () => {
  const androidProduction = {
    rawEnv: "http://localhost:8080",
    mode: "android" as const,
    isDev: false,
    isNative: true,
  };

  it("resolves subscription requests to the canonical /api path", () => {
    expect(resolveApiUrl("/api/subscription?region=global", androidProduction)).toBe(
      "https://getmindfulspace.com/api/subscription?region=global",
    );
    expect(resolveApiUrl("/api/subscription?region=global", androidProduction)).not.toContain(
      "/api/api/",
    );
  });

  it("resolves AI Companion requests to the canonical /api path", () => {
    expect(resolveApiUrl("/api/ai/coach", androidProduction)).toBe(
      "https://getmindfulspace.com/api/ai/coach",
    );
    expect(resolveApiUrl("/api/ai/reports", androidProduction)).toBe(
      "https://getmindfulspace.com/api/ai/reports",
    );
  });

  it("keeps authorization independent from URL resolution", () => {
    const url = resolveApiUrl("/api/subscription", androidProduction);
    expect(url.startsWith("https://getmindfulspace.com/api/")).toBe(true);
  });
});
