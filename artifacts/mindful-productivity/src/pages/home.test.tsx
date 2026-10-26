import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/context/LanguageContext";

const mocks = vi.hoisted(() => ({
  native: false,
  user: null as null | { id: string },
  loading: false,
  setLocation: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.native,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: mocks.loading,
  }),
}));

vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    ...actual,
    useLocation: () => ["/", mocks.setLocation],
  };
});

import HomeRoute from "./home";

function renderHome() {
  return render(
    <LanguageProvider>
      <HomeRoute />
    </LanguageProvider>,
  );
}

describe("web home route", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.native = false;
    mocks.user = null;
    mocks.loading = false;
    mocks.setLocation.mockClear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("shows the public landing page for signed-out web visitors", () => {
    renderHome();
    expect(screen.getByTestId("landing-page")).not.toBeNull();
    expect(mocks.setLocation).not.toHaveBeenCalled();
  });

  it("sends signed-in users to the dashboard", async () => {
    mocks.user = { id: "user-1" };
    renderHome();
    await waitFor(() => {
      expect(mocks.setLocation).toHaveBeenCalledWith("/dashboard");
    });
    expect(screen.queryByTestId("landing-page")).toBeNull();
  });

  it("keeps native guests on the existing auth screen", async () => {
    mocks.native = true;
    renderHome();
    await waitFor(() => {
      expect(mocks.setLocation).toHaveBeenCalledWith("/auth");
    });
    expect(screen.queryByTestId("landing-page")).toBeNull();
  });
});
