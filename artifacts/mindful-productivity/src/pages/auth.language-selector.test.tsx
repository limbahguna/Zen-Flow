import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/context/LanguageContext";
import AuthPage from "./auth";

const mocks = vi.hoisted(() => ({
  setLocation: vi.fn(),
  toast: vi.fn(),
  signIn: vi.fn(async () => ({ error: null })),
  signUp: vi.fn(async () => ({ error: null })),
  user: null as null | { id: string },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/auth", mocks.setLocation],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    signIn: mocks.signIn,
    signUp: mocks.signUp,
    user: mocks.user,
    loading: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/native", () => ({
  OAUTH_ERROR_EVENT: "mindful-oauth-error",
  OAUTH_FINISHED_EVENT: "mindful-oauth-finished",
  OAUTH_SUCCESS_EVENT: "mindful-oauth-success",
  isNativeApp: () => false,
  openGoogleSignIn: vi.fn(async () => ({ error: null })),
  requestPasswordReset: vi.fn(async () => ({ error: null })),
}));

function renderAuth() {
  return render(
    <LanguageProvider>
      <AuthPage />
    </LanguageProvider>,
  );
}

describe("public auth language selector", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.setLocation.mockClear();
    mocks.toast.mockClear();
    mocks.signIn.mockClear();
    mocks.signUp.mockClear();
    mocks.user = null;
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("shows all three language labels on the public auth surface", () => {
    renderAuth();

    const selector = screen.getByTestId("language-selector");
    expect(selector).not.toBeNull();
    expect(screen.getByRole("option", { name: "English" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Bahasa Indonesia" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "日本語" })).not.toBeNull();
    expect(screen.getByLabelText("Select language")).toBe(selector);
  });

  it("persists Indonesian and translates the sign-in and sign-up states", async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.selectOptions(screen.getByTestId("language-selector"), "id");

    expect(localStorage.getItem("mindful_language")).toBe("id");
    expect(screen.getByTestId("tab-signin").textContent).toContain("Masuk");

    await user.click(screen.getByTestId("tab-signup"));
    expect(screen.getByTestId("tab-signup").textContent).toContain("Daftar");
    expect(screen.getByTestId("button-submit-signup").textContent).toContain("Buat Akun");
  });

  it("restores Japanese after remount and keeps auth copy translated", async () => {
    const user = userEvent.setup();
    const { unmount } = renderAuth();

    await user.selectOptions(screen.getByTestId("language-selector"), "ja");
    unmount();
    renderAuth();

    expect((screen.getByTestId("language-selector") as HTMLSelectElement).value).toBe("ja");
    expect(screen.getByTestId("tab-signin").textContent).toContain("サインイン");
    expect(screen.getByLabelText("言語を選択")).not.toBeNull();
  });

  it("leaves the auth route after an OAuth session becomes available", () => {
    mocks.user = { id: "oauth-user" };
    renderAuth();

    expect(mocks.setLocation).toHaveBeenCalledWith("/dashboard");
  });

  it("opens the dashboard after a successful email sign-in", async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.type(screen.getByTestId("input-email-signin"), "person@example.com");
    await user.type(screen.getByTestId("input-password-signin"), "password123");
    await user.click(screen.getByTestId("button-submit-signin"));

    expect(mocks.signIn).toHaveBeenCalledWith("person@example.com", "password123");
    await waitFor(() => {
      expect(mocks.setLocation).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("opens the dashboard after the native Google OAuth success event", async () => {
    renderAuth();

    window.dispatchEvent(new Event("mindful-oauth-success"));

    await waitFor(() => {
      expect(mocks.setLocation).toHaveBeenCalledWith("/dashboard");
    });
  });
});