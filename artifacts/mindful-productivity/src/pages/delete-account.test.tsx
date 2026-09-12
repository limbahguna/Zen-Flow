/**
 * Tests for /delete-account page.
 *
 * Verified properties:
 *   1. Public page accessible without a session (unauthenticated view rendered)
 *   2. Authenticated view shows Danger Zone and delete button
 *   3. EN / ID / JA each have the correct confirmation word
 *   4. 2-step dialog: step 1 → step 2 → submit only when confirmation word matches
 *   5. signOut() is called BEFORE localStorage is cleared on success
 *   6. On success: session cleared, localStorage cleared, redirect to /auth
 *   7. API error renders the error state; no redirect, no signOut
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Router } from "wouter";
import { LanguageProvider } from "@/context/LanguageContext";
import type { LanguageCode } from "@/lib/translations";
import DeleteAccountPage from "./delete-account";

// ── Module mocks ───────────────────────────────────────────────────────────────

// Prevent real Supabase calls
vi.mock("@/lib/supabase", () => ({
  default: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock("../lib/supabase", () => ({
  default: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

const mockSignOut = vi.fn(() => Promise.resolve({ error: null }));
const mockSetLocation = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    ...actual,
    useLocation: vi.fn(() => ["/delete-account", mockSetLocation]),
  };
});

// ── Test helpers ──────────────────────────────────────────────────────────────

import { useAuth } from "@/hooks/useAuth";
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

function setAuthState(
  opts: { loggedIn: boolean; email?: string; accessToken?: string } = {
    loggedIn: false,
  },
) {
  if (opts.loggedIn) {
    mockUseAuth.mockReturnValue({
      user: { id: "test-user-id", email: opts.email ?? "user@example.com" },
      session: { access_token: opts.accessToken ?? "test-access-token" },
      loading: false,
      signOut: mockSignOut,
      signIn: vi.fn(),
      signUp: vi.fn(),
    });
  } else {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signOut: mockSignOut,
      signIn: vi.fn(),
      signUp: vi.fn(),
    });
  }
}

/**
 * Render the page inside required providers.
 * LanguageProvider reads its initial language from localStorage, so callers
 * must call localStorage.setItem("mindful_language", lang) before rendering.
 */
function renderPage() {
  return render(
    <LanguageProvider>
      <Router>
        <DeleteAccountPage />
      </Router>
    </LanguageProvider>,
  );
}

async function openStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("btn-open-delete-dialog"));
  await user.click(screen.getByTestId("btn-confirm1-continue"));
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSetLocation.mockClear();
  mockSignOut.mockClear();
  setAuthState({ loggedIn: false });
  try { localStorage.removeItem("mindful_language"); } catch {}
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch {}
});

// ── 1. Public page accessible without a session ───────────────────────────────

describe("/delete-account — public page (unauthenticated)", () => {
  it("renders without crashing when user is not logged in", () => {
    renderPage();
    expect(screen.getByTestId("delete-back-btn")).toBeDefined();
  });

  it("shows the guest sign-in section (not the Danger Zone) when unauthenticated", () => {
    renderPage();
    expect(screen.getByTestId("delete-guest-section")).toBeDefined();
    expect(screen.queryByTestId("delete-danger-zone")).toBeNull();
  });

  it("shows developer info with app name for Google Play compliance", () => {
    renderPage();
    const info = screen.getByTestId("delete-developer-info");
    expect(info.textContent).toContain("Mindful Space");
  });

  it("guest CTA navigates to /auth when clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("btn-guest-sign-in"));
    expect(mockSetLocation).toHaveBeenCalledWith("/auth");
  });
});

// ── 2. Authenticated view ─────────────────────────────────────────────────────

describe("/delete-account — authenticated view", () => {
  beforeEach(() => setAuthState({ loggedIn: true }));

  it("shows the Danger Zone (not the guest section) when logged in", () => {
    renderPage();
    expect(screen.getByTestId("delete-danger-zone")).toBeDefined();
    expect(screen.queryByTestId("delete-guest-section")).toBeNull();
  });

  it("opens step-1 dialog when Delete Account button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("btn-open-delete-dialog"));
    expect(screen.getByTestId("delete-dialog")).toBeDefined();
    expect(screen.getByTestId("btn-confirm1-continue")).toBeDefined();
  });

  it("cancelling step-1 closes the dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("btn-open-delete-dialog"));
    await user.click(screen.getByTestId("btn-confirm1-cancel"));
    expect(screen.queryByTestId("delete-dialog")).toBeNull();
  });

  it("proceeding step-1 opens step-2 with type-to-confirm input", async () => {
    const user = userEvent.setup();
    renderPage();
    await openStep2(user);
    expect(screen.getByTestId("input-confirm-delete")).toBeDefined();
    expect(screen.getByTestId("btn-confirm2-submit")).toBeDefined();
  });

  it("submit button is disabled until the correct confirmation word is typed", async () => {
    const user = userEvent.setup();
    renderPage();
    await openStep2(user);

    const input = screen.getByTestId("input-confirm-delete");
    const btn = screen.getByTestId("btn-confirm2-submit") as HTMLButtonElement;

    expect(btn.disabled).toBe(true);

    await user.type(input, "DEL"); // partial — still disabled
    expect(btn.disabled).toBe(true);

    await user.clear(input);
    await user.type(input, "DELETE");
    expect(btn.disabled).toBe(false);
  });
});

// ── 3. EN / ID / JA confirmation word ────────────────────────────────────────

describe("/delete-account — confirmation word per locale", () => {
  beforeEach(() => setAuthState({ loggedIn: true }));

  it("EN: submit enabled only when user types DELETE", async () => {
    try { localStorage.setItem("mindful_language", "en"); } catch {}
    const user = userEvent.setup();
    renderPage();
    await openStep2(user);

    const input = screen.getByTestId("input-confirm-delete");
    const btn = screen.getByTestId("btn-confirm2-submit") as HTMLButtonElement;

    await user.type(input, "DELETE");
    expect(btn.disabled).toBe(false);
  });

  it("ID: submit enabled when user types HAPUS (Indonesian confirmation word)", async () => {
    try { localStorage.setItem("mindful_language", "id"); } catch {}
    const user = userEvent.setup();
    renderPage();
    await openStep2(user);

    const input = screen.getByTestId("input-confirm-delete");
    const btn = screen.getByTestId("btn-confirm2-submit") as HTMLButtonElement;

    await user.type(input, "HAPUS");
    expect(btn.disabled).toBe(false);
  });

  it("ID: submit stays DISABLED when user types DELETE in Indonesian locale", async () => {
    try { localStorage.setItem("mindful_language", "id"); } catch {}
    const user = userEvent.setup();
    renderPage();
    await openStep2(user);

    const input = screen.getByTestId("input-confirm-delete");
    const btn = screen.getByTestId("btn-confirm2-submit") as HTMLButtonElement;

    await user.type(input, "DELETE");
    expect(btn.disabled).toBe(true);
  });

  it("JA: submit enabled when user types DELETE (Japanese locale)", async () => {
    try { localStorage.setItem("mindful_language", "ja"); } catch {}
    const user = userEvent.setup();
    renderPage();
    await openStep2(user);

    const input = screen.getByTestId("input-confirm-delete");
    const btn = screen.getByTestId("btn-confirm2-submit") as HTMLButtonElement;

    await user.type(input, "DELETE");
    expect(btn.disabled).toBe(false);
  });
});

// ── 4. signOut before localStorage.clear ────────────────────────────────────

describe("/delete-account — signOut called before localStorage is cleared", () => {
  beforeEach(() => setAuthState({ loggedIn: true, accessToken: "tok-abc" }));

  it("calls signOut() before clearing localStorage on successful deletion", async () => {
    const callOrder: string[] = [];

    mockSignOut.mockImplementation(async () => {
      callOrder.push("signOut");
      return { error: null };
    });

    const origClear = localStorage.clear.bind(localStorage);
    vi.spyOn(Storage.prototype, "clear").mockImplementation(function () {
      callOrder.push("localStorage.clear");
      origClear();
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 204 } as Response)),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("btn-open-delete-dialog"));
    await user.click(screen.getByTestId("btn-confirm1-continue"));
    await user.type(screen.getByTestId("input-confirm-delete"), "DELETE");
    await user.click(screen.getByTestId("btn-confirm2-submit"));

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/auth");
    });

    expect(callOrder.indexOf("signOut")).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf("localStorage.clear")).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf("signOut")).toBeLessThan(
      callOrder.indexOf("localStorage.clear"),
    );
  });
});

// ── 5. Success: redirect + signOut ───────────────────────────────────────────

describe("/delete-account — success path", () => {
  beforeEach(() => setAuthState({ loggedIn: true, accessToken: "tok-abc" }));

  it("redirects to /auth after successful account deletion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 204 } as Response)),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("btn-open-delete-dialog"));
    await user.click(screen.getByTestId("btn-confirm1-continue"));
    await user.type(screen.getByTestId("input-confirm-delete"), "DELETE");
    await user.click(screen.getByTestId("btn-confirm2-submit"));

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/auth");
    });

    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it("sends DELETE request with Bearer token from the active session", async () => {
    const captured: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init: RequestInit) => {
        captured.push({ url, init });
        return Promise.resolve({ ok: true, status: 204 } as Response);
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("btn-open-delete-dialog"));
    await user.click(screen.getByTestId("btn-confirm1-continue"));
    await user.type(screen.getByTestId("input-confirm-delete"), "DELETE");
    await user.click(screen.getByTestId("btn-confirm2-submit"));

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/auth");
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].init.method).toBe("DELETE");
    const authHeader = (captured[0].init.headers as Record<string, string>)?.Authorization;
    expect(authHeader).toBe("Bearer tok-abc");
  });
});

// ── 5b. Cache Storage cleared on success ────────────────────────────────────

describe("/delete-account — Cache Storage cleared after deletion", () => {
  beforeEach(() => setAuthState({ loggedIn: true, accessToken: "tok-abc" }));

  it("deletes all Cache Storage entries after successful deletion", async () => {
    const cacheNames = ["workbox-v1", "supabase-fetch-cache"];
    const mockCacheDelete = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal("caches", {
      keys: vi.fn(() => Promise.resolve(cacheNames)),
      delete: mockCacheDelete,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 204 } as Response)),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("btn-open-delete-dialog"));
    await user.click(screen.getByTestId("btn-confirm1-continue"));
    await user.type(screen.getByTestId("input-confirm-delete"), "DELETE");
    await user.click(screen.getByTestId("btn-confirm2-submit"));

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/auth");
    });

    expect(mockCacheDelete).toHaveBeenCalledWith("workbox-v1");
    expect(mockCacheDelete).toHaveBeenCalledWith("supabase-fetch-cache");
    expect(mockCacheDelete).toHaveBeenCalledTimes(cacheNames.length);
  });

  it("proceeds to redirect even when Cache Storage is unavailable", async () => {
    vi.stubGlobal("caches", {
      keys: vi.fn(() => Promise.reject(new Error("NotSupported"))),
      delete: vi.fn(),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 204 } as Response)),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("btn-open-delete-dialog"));
    await user.click(screen.getByTestId("btn-confirm1-continue"));
    await user.type(screen.getByTestId("input-confirm-delete"), "DELETE");
    await user.click(screen.getByTestId("btn-confirm2-submit"));

    // Must still redirect even if Cache Storage throws
    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith("/auth");
    });
  });
});

// ── 6. Error handling ─────────────────────────────────────────────────────────

describe("/delete-account — error handling", () => {
  beforeEach(() => setAuthState({ loggedIn: true, accessToken: "tok-abc" }));

  it("shows the error state when the API returns a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: "Server error" }),
        } as unknown as Response),
      ),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("btn-open-delete-dialog"));
    await user.click(screen.getByTestId("btn-confirm1-continue"));
    await user.type(screen.getByTestId("input-confirm-delete"), "DELETE");
    await user.click(screen.getByTestId("btn-confirm2-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("btn-error-close")).toBeDefined();
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockSetLocation).not.toHaveBeenCalledWith("/auth");
  });

  it("shows the error state when fetch throws a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("NetworkError"))),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId("btn-open-delete-dialog"));
    await user.click(screen.getByTestId("btn-confirm1-continue"));
    await user.type(screen.getByTestId("input-confirm-delete"), "DELETE");
    await user.click(screen.getByTestId("btn-confirm2-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("btn-error-close")).toBeDefined();
    });

    expect(mockSetLocation).not.toHaveBeenCalledWith("/auth");
  });
});
