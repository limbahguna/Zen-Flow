import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AuthTokenUnavailableError,
  customFetch,
  setAuthTokenGetter,
  setBaseUrl,
} from "./custom-fetch";

afterEach(() => {
  setAuthTokenGetter(null);
  setBaseUrl(null);
  vi.unstubAllGlobals();
});

describe("authenticated custom fetch", () => {
  it("gets a fresh session token for every API request and sends it as Bearer authorization", async () => {
    let accessToken = "first-session-token";
    const fetchSpy = vi.fn(async () => new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchSpy);
    setAuthTokenGetter(() => accessToken);

    await customFetch("/api/tasks", { responseType: "json" });
    accessToken = "refreshed-session-token";
    await customFetch("/api/moods", { responseType: "json" });

    const firstHeaders = new Headers(fetchSpy.mock.calls[0][1].headers);
    const secondHeaders = new Headers(fetchSpy.mock.calls[1][1].headers);
    expect(firstHeaders.get("authorization")).toBe("Bearer first-session-token");
    expect(secondHeaders.get("authorization")).toBe("Bearer refreshed-session-token");
  });

  it("does not call the network as an anonymous user when the session token is unavailable", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    setAuthTokenGetter(() => null);

    await expect(customFetch("/api/tasks")).rejects.toBeInstanceOf(AuthTokenUnavailableError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("prepends a remote origin without duplicating /api", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchSpy);
    setBaseUrl("https://getmindfulspace.com");

    await customFetch("/api/sleep/insights", { responseType: "json" });

    expect(fetchSpy.mock.calls[0][0]).toBe("https://getmindfulspace.com/api/sleep/insights");
  });
});