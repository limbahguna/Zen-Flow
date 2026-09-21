import { afterEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.hoisted(() => ({ setBaseUrl: vi.fn() }));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock("@workspace/api-client-react", () => ({
  setBaseUrl: apiClient.setBaseUrl,
}));

import { configureAppApiBase } from "./apiRuntime";
import { CANONICAL_PRODUCTION_API_ORIGIN } from "./apiBaseUrl";

describe("configureAppApiBase", () => {
  afterEach(() => {
    apiClient.setBaseUrl.mockReset();
  });

  it("clears the generated client base URL for same-origin browser production", () => {
    configureAppApiBase({
      rawEnv: "http://localhost:8080",
      mode: "production",
      isDev: false,
      isNative: false,
    });
    expect(apiClient.setBaseUrl).toHaveBeenCalledWith(null);
  });

  it("points the generated client at the canonical origin on native production", () => {
    configureAppApiBase({
      rawEnv: "",
      mode: "android",
      isDev: false,
      isNative: true,
    });
    expect(apiClient.setBaseUrl).toHaveBeenCalledWith(
      CANONICAL_PRODUCTION_API_ORIGIN,
    );
  });
});
