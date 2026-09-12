import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import supabase from "./supabase";

export const NATIVE_AUTH_REDIRECT =
  "com.davidhendrya.mindfulspace://auth/callback";
export const PRODUCTION_AUTH_REDIRECT = "https://getmindfulspace.com";
export const PRODUCTION_PASSWORD_RESET_REDIRECT =
  "https://getmindfulspace.com/reset-password";
export const OAUTH_ERROR_EVENT = "mindful-oauth-error";
export const OAUTH_FINISHED_EVENT = "mindful-oauth-finished";
export const OAUTH_SUCCESS_EVENT = "mindful-oauth-success";
export const OAUTH_CALLBACK_TIMEOUT_MS = 15_000;
export const OAUTH_BROWSER_FINISH_GRACE_MS = 3_000;

const callbackOperations = new Map<string, Promise<void>>();
const handledCallbacks = new Set<string>();
const MAX_HANDLED_CALLBACKS = 20;
const OAUTH_ATTEMPT_STORAGE_KEY = "mindful_native_oauth_pending";
const OAUTH_ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000;
const PASSWORD_RECOVERY_STORAGE_KEY = "mindful_password_recovery_pending";
const PASSWORD_RECOVERY_MAX_AGE_MS = 60 * 60 * 1000;
let browserFinishedGraceTimer: number | null = null;

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

type AuthLocation = Pick<Location, "hostname" | "origin">;

export function getWebAuthRedirect(location?: AuthLocation): string {
  const activeLocation =
    location ?? (typeof window === "undefined" ? null : window.location);
  if (!activeLocation) {
    return PRODUCTION_AUTH_REDIRECT;
  }

  const hostname = activeLocation.hostname.toLowerCase();
  if (hostname === "getmindfulspace.com" || hostname === "www.getmindfulspace.com") {
    return PRODUCTION_AUTH_REDIRECT;
  }

  return activeLocation.origin;
}

function toError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) return value;
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return new Error(message);
    }
  }
  return new Error(fallbackMessage);
}

function dispatchOAuthError(error: unknown): void {
  const normalized = toError(error, "Google sign-in could not be completed.");
  window.dispatchEvent(
    new CustomEvent(OAUTH_ERROR_EVENT, {
      detail: { message: normalized.message },
    }),
  );
}

function dispatchOAuthFinished(): void {
  window.dispatchEvent(new Event(OAUTH_FINISHED_EVENT));
}

function finishOAuthSuccess(): void {
  window.dispatchEvent(new Event(OAUTH_SUCCESS_EVENT));
  if (window.location.pathname !== "/dashboard") {
    window.history.replaceState(null, "", "/dashboard");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs = OAUTH_CALLBACK_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Google sign-in timed out. Please try again."));
    }, timeoutMs);

    Promise.resolve(operation).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function beginOAuthAttempt(): boolean {
  clearBrowserFinishedGraceTimer();
  cancelPasswordRecoveryAttempt();
  try {
    window.localStorage.setItem(OAUTH_ATTEMPT_STORAGE_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

function beginPasswordRecoveryAttempt(): boolean {
  clearBrowserFinishedGraceTimer();
  cancelOAuthAttempt();
  try {
    window.localStorage.setItem(
      PASSWORD_RECOVERY_STORAGE_KEY,
      String(Date.now()),
    );
    return true;
  } catch {
    return false;
  }
}

function hasPasswordRecoveryAttempt(): boolean {
  try {
    const stored = window.localStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY);
    if (!stored) return false;
    const startedAt = Number(stored);
    const age = Date.now() - startedAt;
    if (
      !Number.isFinite(startedAt) ||
      age < 0 ||
      age > PASSWORD_RECOVERY_MAX_AGE_MS
    ) {
      window.localStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function consumePasswordRecoveryAttempt(): boolean {
  const valid = hasPasswordRecoveryAttempt();
  try {
    window.localStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    return false;
  }
  return valid;
}

function cancelPasswordRecoveryAttempt(): void {
  try {
    window.localStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  } catch {
    // Storage errors are surfaced when a new flow is started.
  }
}

function consumeOAuthAttempt(): boolean {
  clearBrowserFinishedGraceTimer();
  try {
    const stored = window.localStorage.getItem(OAUTH_ATTEMPT_STORAGE_KEY);
    window.localStorage.removeItem(OAUTH_ATTEMPT_STORAGE_KEY);
    if (!stored) return false;

    const startedAt = Number(stored);
    const age = Date.now() - startedAt;
    return Number.isFinite(startedAt) && age >= 0 && age <= OAUTH_ATTEMPT_MAX_AGE_MS;
  } catch {
    return false;
  }
}

function cancelOAuthAttempt(): boolean {
  try {
    const existed = window.localStorage.getItem(OAUTH_ATTEMPT_STORAGE_KEY) !== null;
    window.localStorage.removeItem(OAUTH_ATTEMPT_STORAGE_KEY);
    return existed;
  } catch {
    return false;
  }
}

function clearBrowserFinishedGraceTimer(): void {
  if (browserFinishedGraceTimer === null) return;
  window.clearTimeout(browserFinishedGraceTimer);
  browserFinishedGraceTimer = null;
}

function scheduleBrowserFinishedCancellation(): void {
  clearBrowserFinishedGraceTimer();
  browserFinishedGraceTimer = window.setTimeout(() => {
    browserFinishedGraceTimer = null;
    if (cancelOAuthAttempt()) dispatchOAuthFinished();
  }, OAUTH_BROWSER_FINISH_GRACE_MS);
}

export async function openGoogleSignIn(): Promise<{ error: Error | null }> {
  const native = isNativeApp();
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: native ? NATIVE_AUTH_REDIRECT : getWebAuthRedirect(),
        ...(native ? { skipBrowserRedirect: true } : {}),
      },
    });

    if (error) return { error };
    if (native) {
      if (!data.url) {
        return {
          error: new Error("Google sign-in returned no authorization URL."),
        };
      }
      if (!beginOAuthAttempt()) {
        return {
          error: new Error("Google sign-in could not store its secure login state."),
        };
      }
      try {
        await Browser.open({ url: data.url });
      } catch (error) {
        cancelOAuthAttempt();
        throw error;
      }
    }
    return { error: null };
  } catch (error) {
    return { error: toError(error, "Google sign-in could not be started.") };
  }
}

export async function requestPasswordReset(
  email: string,
): Promise<{ error: Error | null }> {
  const native = isNativeApp();
  if (native && !beginPasswordRecoveryAttempt()) {
    return {
      error: new Error("Password recovery could not store its secure state."),
    };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: native
        ? NATIVE_AUTH_REDIRECT
        : PRODUCTION_PASSWORD_RESET_REDIRECT,
    });
    if (error && native) cancelPasswordRecoveryAttempt();
    return { error: error ? toError(error, "Password reset could not be started.") : null };
  } catch (error) {
    if (native) cancelPasswordRecoveryAttempt();
    return { error: toError(error, "Password reset could not be started.") };
  }
}

/**
 * Process an OAuth callback URL received via deep link.
 * Handles both PKCE (code) and implicit (access_token in hash) flows.
 * Closes the in-app browser for every valid terminal callback and dispatches
 * detailed errors so the auth page never remains on an unexplained spinner.
 */
export async function handleOAuthCallbackUrl(url: string): Promise<void> {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(url);
  } catch {
    return;
  }

  if (
    callbackUrl.protocol !== "com.davidhendrya.mindfulspace:" ||
    callbackUrl.hostname !== "auth" ||
    callbackUrl.pathname !== "/callback"
  ) {
    return;
  }

  const callbackKey = `${callbackUrl.search}|${callbackUrl.hash}`;
  if (handledCallbacks.has(callbackKey)) return;
  const activeOperation = callbackOperations.get(callbackKey);
  if (activeOperation) {
    await activeOperation;
    return;
  }

  const operation = hasPasswordRecoveryAttempt()
    ? processPasswordRecoveryCallback(callbackUrl)
    : processOAuthCallback(callbackUrl);
  callbackOperations.set(callbackKey, operation);
  try {
    await operation;
  } finally {
    callbackOperations.delete(callbackKey);
    handledCallbacks.add(callbackKey);
    if (handledCallbacks.size > MAX_HANDLED_CALLBACKS) {
      const oldest = handledCallbacks.values().next().value;
      if (typeof oldest === "string") handledCallbacks.delete(oldest);
    }
  }
}

async function processPasswordRecoveryCallback(
  callbackUrl: URL,
): Promise<void> {
  const queryParams = new URLSearchParams(callbackUrl.search);
  const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
  if (!consumePasswordRecoveryAttempt()) {
    navigateToPasswordReset(
      "Password recovery is expired or was not requested on this device.",
    );
    return;
  }

  const errorCode = queryParams.get("error") ?? hashParams.get("error");
  if (errorCode) {
    navigateToPasswordReset(
      queryParams.get("error_description") ??
        hashParams.get("error_description") ??
        errorCode,
    );
    return;
  }

  const code = queryParams.get("code") ?? hashParams.get("code");
  if (!code) {
    navigateToPasswordReset("Password recovery returned no authorization code.");
    return;
  }

  try {
    const { error } = await withTimeout(
      supabase.auth.exchangeCodeForSession(code),
    );
    navigateToPasswordReset(error ? toError(error, "Password recovery failed.").message : null);
  } catch (error) {
    navigateToPasswordReset(
      toError(error, "Password recovery could not be completed.").message,
    );
  }
}

function navigateToPasswordReset(error: string | null): void {
  const target = error
    ? `/reset-password?error=${encodeURIComponent(error)}`
    : "/reset-password";
  window.history.replaceState(null, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function processOAuthCallback(callbackUrl: URL): Promise<void> {
  const queryParams = new URLSearchParams(callbackUrl.search);
  const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
  if (!consumeOAuthAttempt()) {
    dispatchOAuthError(
      new Error("Google sign-in callback is expired or was not requested."),
    );
    await closeOAuthBrowser();
    dispatchOAuthFinished();
    return;
  }

  const errorCode = queryParams.get("error") ?? hashParams.get("error");
  if (errorCode) {
    const errorDescription =
      queryParams.get("error_description") ??
      hashParams.get("error_description") ??
      errorCode;
    dispatchOAuthError(new Error(errorDescription));
    await closeOAuthBrowser();
    dispatchOAuthFinished();
    return;
  }

  let succeeded = false;
  try {
    const code = queryParams.get("code") ?? hashParams.get("code");
    if (code) {
      const { error } = await withTimeout(
        supabase.auth.exchangeCodeForSession(code),
      );
      if (error) {
        dispatchOAuthError(error);
      } else {
        succeeded = true;
      }
    } else {
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        dispatchOAuthError(
          new Error(
            "Google sign-in returned an unsupported implicit session. Please try again.",
          ),
        );
      } else {
        dispatchOAuthError(
          new Error("Google sign-in returned no authorization response."),
        );
      }
    }
  } catch (error) {
    dispatchOAuthError(error);
  } finally {
    if (succeeded) finishOAuthSuccess();
    await closeOAuthBrowser();
    dispatchOAuthFinished();
  }
}

async function closeOAuthBrowser(): Promise<void> {
  try {
    await Browser.close();
  } catch {
    // Browser.close() can reject when the user already dismissed the tab.
  }
}

export async function initializeNativeRuntime(): Promise<void> {
  const native = isNativeApp();
  document.documentElement.classList.toggle("capacitor-native", native);
  if (!native) return;

  // Register this first, before any launch URL or React startup work, so a
  // warm-start deep link cannot be lost while the rest of the runtime starts.
  await App.addListener("appUrlOpen", async ({ url }) => {
    await handleOAuthCallbackUrl(url);
  });

  await Browser.addListener("browserFinished", () => {
    scheduleBrowserFinishedCancellation();
  });

  // A cold-start callback may already be waiting after listener registration.
  try {
    const launchUrlResult = await App.getLaunchUrl();
    if (launchUrlResult?.url) {
      await handleOAuthCallbackUrl(launchUrlResult.url);
    }
  } catch {
    // getLaunchUrl() is best-effort; normal warm-start handling remains active.
  }

  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack && window.history.length > 1) {
      window.history.back();
    } else {
      void App.exitApp();
    }
  });
}
