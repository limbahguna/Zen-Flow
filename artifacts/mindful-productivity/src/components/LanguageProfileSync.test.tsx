import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { LanguageProfileSync } from "./LanguageProfileSync";

const mocks = vi.hoisted(() => ({
  user: {
    id: "user-1",
    user_metadata: { language: "ja" },
  },
  setLanguage: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({ setLanguage: mocks.setLanguage }),
}));

describe("LanguageProfileSync", () => {
  it("hydrates a supported profile language for a returning user", async () => {
    render(<LanguageProfileSync />);

    await waitFor(() => expect(mocks.setLanguage).toHaveBeenCalledWith("ja"));
  });

  it("ignores unsupported profile language values", async () => {
    mocks.setLanguage.mockClear();
    mocks.user.user_metadata.language = "es";
    render(<LanguageProfileSync />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.setLanguage).not.toHaveBeenCalled();
    mocks.user.user_metadata.language = "ja";
  });
});