import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  native: true,
  launchUrl: null as null | { url: string },
  appListeners: new Map<string, (...args: any[]) => any>(),
  browserListeners: new Map<string, (...args: any[]) => any>(),
  appAddListener: vi.fn(),
  getLaunchUrl: vi.fn(),
  signInWithOAuth: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  setSession: vi.fn(),
  browserOpen: vi.fn(),
  browserClose: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.native,
  },
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: mocks.appAddListener.mockImplementation(async (event: string, handler: (...args: any[]) => any) => {
      mocks.appListeners.set(event, handler);
      return { remove: vi.fn() };
    }),
    getLaunchUrl: mocks.getLaunchUrl.mockImplementation(async () => mocks.launchUrl),
    exitApp: vi.fn(),
  },
}));

vi.mock("@capacitor/browser", () => ({
  Browser: {
    open: mocks.browserOpen,
    close: mocks.browserClose,
    addListener: vi.fn(async (event: string, handler: (...args: any[]) => any) => {
      mocks.browserListeners.set(event, handler);
      return { remove: vi.fn() };
    }),
  },
}));

vi.mock("./supabase", () => ({
  default: {
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      setSession: mocks.setSession,
    },
  },
}));

import {
  NATIVE_AUTH_REDIRECT,
  OAUTH_BROWSER_FINISH_GRACE_MS,
  OAUTH_CALLBACK_TIMEOUT_MS,
  OAUTH_ERROR_EVENT,
  OAUTH_FINISHED_EVENT,
  OAUTH_SUCCESS_EVENT,
  PRODUCTION_AUTH_REDIRECT,
  PRODUCTION_PASSWORD_RESET_REDIRECT,
  getWebAuthRedirect,
  handleOAuthCallbackUrl,
  initializeNativeRuntime,
  openGoogleSignIn,
  requestPasswordReset,
} from "./native";

describe("native Google OAuth", () => {
  beforeEach(() => {
    mocks.native = true;
    mocks.launchUrl = null;
    mocks.appListeners.clear();
    mocks.browserListeners.clear();
    mocks.appAddListener.mockClear();
    mocks.getLaunchUrl.mockClear();
    mocks.signInWithOAuth.mockReset();
    mocks.resetPasswordForEmail.mockReset();
    mocks.exchangeCodeForSession.mockReset();
    mocks.setSession.mockReset();
    mocks.browserOpen.mockReset();
    mocks.browserClose.mockReset();
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/oauth" },
      error: null,
    });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.setSession.mockResolvedValue({ error: null });
    mocks.browserOpen.mockResolvedValue(undefined);
    mocks.browserClose.mockResolvedValue(undefined);
    window.localStorage.clear();
    window.history.replaceState(null, "", "/auth");
  });

  async function startNativeOAuthAttempt() {
    const result = await openGoogleSignIn();
    expect(result.error).toBeNull();
  }

  it("uses the canonical production domain and preserves active preview origins", () => {
    expect(
      getWebAuthRedirect({
        hostname: "www.getmindfulspace.com",
        origin: "https://www.getmindfulspace.com",
      }),
    ).toBe(PRODUCTION_AUTH_REDIRECT);
    expect(
      getWebAuthRedirect({
        hostname: "preview.example.dev",
        origin: "https://preview.example.dev",
      }),
    ).toBe("https://preview.example.dev");
  });

  it("opens native Google OAuth with the registered custom callback", async () => {
    const result = await openGoogleSignIn();

    expect(result.error).toBeNull();
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: NATIVE_AUTH_REDIRECT,
        skipBrowserRedirect: true,
      },
    });
    expect(mocks.browserOpen).toHaveBeenCalledWith({
      url: "https://accounts.google.com/oauth",
    });
  });

  it("returns a visible error when native OAuth has no authorization URL", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: { url: null },
      error: null,
    });

    const result = await openGoogleSignIn();

    expect(result.error?.message).toBe(
      "Google sign-in returned no authorization URL.",
    );
    expect(mocks.browserOpen).not.toHaveBeenCalled();
  });

  it("requests native password recovery with the registered callback", async () => {
    const result = await requestPasswordReset("person@example.com");

    expect(result.error).toBeNull();
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "person@example.com",
      { redirectTo: NATIVE_AUTH_REDIRECT },
    );
  });

  it("uses the canonical reset page for browser password recovery", async () => {
    mocks.native = false;

    const result = await requestPasswordReset("person@example.com");

    expect(result.error).toBeNull();
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "person@example.com",
      { redirectTo: PRODUCTION_PASSWORD_RESET_REDIRECT },
    );
  });

  it("exchanges a native recovery code and opens the reset page", async () => {
    await requestPasswordReset("person@example.com");

    await handleOAuthCallbackUrl(`${NATIVE_AUTH_REDIRECT}?code=recovery-code`);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
    expect(window.location.pathname).toBe("/reset-password");
    expect(mocks.browserClose).not.toHaveBeenCalled();
  });

  it("exchanges a PKCE callback code and closes the browser", async () => {
    const success = vi.fn();
    window.addEventListener(OAUTH_SUCCESS_EVENT, success);
    await startNativeOAuthAttempt();

    await handleOAuthCallbackUrl(`${NATIVE_AUTH_REDIRECT}?code=pkce-code`);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/dashboard");
    window.removeEventListener(OAUTH_SUCCESS_EVENT, success);
  });

  it("parses hash callbacks but rejects implicit session tokens", async () => {
    const errorListener = vi.fn();
    window.addEventListener(OAUTH_ERROR_EVENT, errorListener);
    await startNativeOAuthAttempt();

    await handleOAuthCallbackUrl(
      `${NATIVE_AUTH_REDIRECT}#access_token=access-secret&refresh_token=refresh-secret`,
    );

    expect(mocks.setSession).not.toHaveBeenCalled();
    expect(
      (errorListener.mock.calls[0][0] as CustomEvent).detail.message,
    ).toContain("unsupported implicit session");
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    window.removeEventListener(OAUTH_ERROR_EVENT, errorListener);
  });

  it("exchanges a PKCE code received in URL hash parameters", async () => {
    await startNativeOAuthAttempt();

    await handleOAuthCallbackUrl(`${NATIVE_AUTH_REDIRECT}#code=hash-pkce-code`);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("hash-pkce-code");
    expect(window.location.pathname).toBe("/dashboard");
  });

  it("reports provider and session exchange errors to the UI", async () => {
    const listener = vi.fn();
    window.addEventListener(OAUTH_ERROR_EVENT, listener);

    await startNativeOAuthAttempt();
    await handleOAuthCallbackUrl(
      `${NATIVE_AUTH_REDIRECT}?error=access_denied&error_description=User%20cancelled`,
    );
    mocks.exchangeCodeForSession.mockResolvedValueOnce({
      error: new Error("Invalid authorization code"),
    });
    await startNativeOAuthAttempt();
    await handleOAuthCallbackUrl(`${NATIVE_AUTH_REDIRECT}?code=bad-code`);

    expect(listener).toHaveBeenCalledTimes(2);
    expect((listener.mock.calls[0][0] as CustomEvent).detail.message).toBe(
      "User cancelled",
    );
    expect((listener.mock.calls[1][0] as CustomEvent).detail.message).toBe(
      "Invalid authorization code",
    );
    window.removeEventListener(OAUTH_ERROR_EVENT, listener);
  });

  it("ignores malformed and unrelated app URLs", async () => {
    await handleOAuthCallbackUrl("not a url");
    await handleOAuthCallbackUrl("mobile://auth/callback?code=wrong-app");

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.setSession).not.toHaveBeenCalled();
    expect(mocks.browserClose).not.toHaveBeenCalled();
  });

  it("rejects unsolicited callbacks that have no active OAuth attempt", async () => {
    const listener = vi.fn();
    window.addEventListener(OAUTH_ERROR_EVENT, listener);

    await handleOAuthCallbackUrl(
      `${NATIVE_AUTH_REDIRECT}?code=unsolicited-code`,
    );

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(
      (listener.mock.calls[0][0] as CustomEvent).detail.message,
    ).toContain("expired or was not requested");
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    window.removeEventListener(OAUTH_ERROR_EVENT, listener);
  });

  it("handles a warm-start callback and navigates without Android Back", async () => {
    await startNativeOAuthAttempt();
    await initializeNativeRuntime();
    const appUrlOpen = mocks.appListeners.get("appUrlOpen");

    expect(appUrlOpen).toBeTypeOf("function");
    await appUrlOpen?.({
      url: `${NATIVE_AUTH_REDIRECT}?code=warm-start-code`,
    });

    expect(mocks.appAddListener.mock.calls[0]?.[0]).toBe("appUrlOpen");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("warm-start-code");
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/dashboard");
  });

  it("lets a warm-start callback win when browserFinished arrives first", async () => {
    vi.useFakeTimers();
    const finished = vi.fn();
    window.addEventListener(OAUTH_FINISHED_EVENT, finished);
    await startNativeOAuthAttempt();
    await initializeNativeRuntime();

    mocks.browserListeners.get("browserFinished")?.();
    await mocks.appListeners.get("appUrlOpen")?.({
      url: `${NATIVE_AUTH_REDIRECT}?code=warm-browser-race-code`,
    });
    await vi.advanceTimersByTimeAsync(OAUTH_BROWSER_FINISH_GRACE_MS);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith(
      "warm-browser-race-code",
    );
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/dashboard");
    expect(finished).toHaveBeenCalledOnce();

    window.removeEventListener(OAUTH_FINISHED_EVENT, finished);
    vi.useRealTimers();
  });

  it("navigates immediately even while the Android browser is still closing", async () => {
    let finishClosing!: () => void;
    mocks.browserClose.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishClosing = resolve;
      }),
    );
    await startNativeOAuthAttempt();

    const callback = handleOAuthCallbackUrl(
      `${NATIVE_AUTH_REDIRECT}?code=slow-browser-close-code`,
    );
    await vi.waitFor(() => {
      expect(mocks.browserClose).toHaveBeenCalledOnce();
    });

    expect(window.location.pathname).toBe("/dashboard");
    finishClosing();
    await callback;
  });

  it("handles a cold-start callback from getLaunchUrl only once", async () => {
    const finished = vi.fn();
    window.addEventListener(OAUTH_FINISHED_EVENT, finished);
    await startNativeOAuthAttempt();
    mocks.launchUrl = { url: `${NATIVE_AUTH_REDIRECT}?code=cold-start-code` };

    await initializeNativeRuntime();
    await mocks.appListeners.get("appUrlOpen")?.({
      url: `${NATIVE_AUTH_REDIRECT}?code=cold-start-code`,
    });

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("cold-start-code");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(mocks.appListeners.has("appUrlOpen")).toBe(true);
    expect(mocks.getLaunchUrl).toHaveBeenCalledOnce();
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/dashboard");
    expect(finished).toHaveBeenCalledOnce();
    window.removeEventListener(OAUTH_FINISHED_EVENT, finished);
  });

  it("lets a cold-start launch URL win when browserFinished arrives first", async () => {
    vi.useFakeTimers();
    let resolveLaunch!: (value: { url: string }) => void;
    mocks.getLaunchUrl.mockReturnValueOnce(
      new Promise<{ url: string }>((resolve) => {
        resolveLaunch = resolve;
      }),
    );
    await startNativeOAuthAttempt();

    const initialization = initializeNativeRuntime();
    await vi.waitFor(() => {
      expect(mocks.browserListeners.has("browserFinished")).toBe(true);
    });
    mocks.browserListeners.get("browserFinished")?.();
    resolveLaunch({
      url: `${NATIVE_AUTH_REDIRECT}?code=cold-browser-race-code`,
    });
    await initialization;
    await vi.advanceTimersByTimeAsync(OAUTH_BROWSER_FINISH_GRACE_MS);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith(
      "cold-browser-race-code",
    );
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/dashboard");
    vi.useRealTimers();
  });

  it("reports a callback timeout, closes the browser, and clears redirecting state", async () => {
    vi.useFakeTimers();
    const errorListener = vi.fn();
    const finishedListener = vi.fn();
    window.addEventListener(OAUTH_ERROR_EVENT, errorListener);
    window.addEventListener(OAUTH_FINISHED_EVENT, finishedListener);
    await startNativeOAuthAttempt();
    mocks.exchangeCodeForSession.mockReturnValueOnce(
      new Promise(() => undefined),
    );

    const callback = handleOAuthCallbackUrl(
      `${NATIVE_AUTH_REDIRECT}?code=timeout-code`,
    );
    await vi.advanceTimersByTimeAsync(OAUTH_CALLBACK_TIMEOUT_MS);
    await callback;

    expect(errorListener).toHaveBeenCalledOnce();
    expect(
      (errorListener.mock.calls[0][0] as CustomEvent).detail.message,
    ).toContain("timed out");
    expect(finishedListener).toHaveBeenCalledOnce();
    expect(mocks.browserClose).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/auth");

    window.removeEventListener(OAUTH_ERROR_EVENT, errorListener);
    window.removeEventListener(OAUTH_FINISHED_EVENT, finishedListener);
    vi.useRealTimers();
  });
});