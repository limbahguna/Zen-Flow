import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/context/LanguageContext";
import ResetPasswordPage from "./reset-password";

const mocks = vi.hoisted(() => ({
  setLocation: vi.fn(),
  toast: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/reset-password", mocks.setLocation],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "recovery-user" },
    loading: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/supabase", () => ({
  default: {
    auth: {
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
    },
  },
}));

function renderPage() {
  return render(
    <LanguageProvider>
      <ResetPasswordPage />
    </LanguageProvider>,
  );
}

describe("password recovery page", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/reset-password");
    localStorage.clear();
    mocks.setLocation.mockClear();
    mocks.toast.mockClear();
    mocks.updateUser.mockReset();
    mocks.signOut.mockReset();
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("updates the password and returns to sign in", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId("input-new-password"), "new-secret");
    await user.type(screen.getByTestId("input-confirm-password"), "new-secret");
    await user.click(screen.getByTestId("button-update-password"));

    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-secret" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.setLocation).toHaveBeenCalledWith("/auth");
  });

  it("does not update when password confirmation differs", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByTestId("input-new-password"), "new-secret");
    await user.type(screen.getByTestId("input-confirm-password"), "different");
    await user.click(screen.getByTestId("button-update-password"));

    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });
});