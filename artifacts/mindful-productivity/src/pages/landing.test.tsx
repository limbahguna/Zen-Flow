import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/context/LanguageContext";
import LandingPage from "./landing";
import { landingText } from "@/lib/landingCopy";

function renderLanding() {
  return render(
    <LanguageProvider>
      <LandingPage />
    </LanguageProvider>,
  );
}

describe("public landing page", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.title = "Mindful Space";
    document.documentElement.removeAttribute("dir");
  });

  it("renders the landing page and sends every login CTA to /auth", () => {
    renderLanding();

    expect(screen.getByTestId("landing-page")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      landingText("en", "hero.title"),
    );

    const authHrefs = [
      "landing-nav-login",
      "landing-hero-cta",
      "landing-hero-login",
      "landing-close-cta",
      "landing-close-login",
      "landing-footer-login",
    ].map((id) => (screen.getByTestId(id) as HTMLAnchorElement).getAttribute("href"));

    expect(authHrefs.every((href) => href === "/auth")).toBe(true);
    const whoPhoto = document.querySelector('img[src="/landing/practice-light.jpg"]');
    expect(whoPhoto?.getAttribute("alt")).toBe(landingText("en", "who.photoAlt"));
    expect(landingText("en", "who.photoAlt").toLowerCase()).toContain("hillside");
  });

  it("switches all four languages without leftover English on Arabic", async () => {
    const user = userEvent.setup();
    renderLanding();

    const selector = screen.getByTestId("landing-language-selector");
    await user.selectOptions(selector, "id");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      landingText("id", "hero.title"),
    );

    await user.selectOptions(selector, "ja");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      landingText("ja", "hero.title"),
    );

    await user.selectOptions(selector, "ar");
    const page = screen.getByTestId("landing-page");
    expect(page.getAttribute("dir")).toBe("rtl");
    expect(page.getAttribute("lang")).toBe("ar");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      landingText("ar", "hero.title"),
    );
    expect(screen.getByTestId("landing-nav-login").textContent).toBe(
      landingText("ar", "nav.login"),
    );
    expect(screen.getByTestId("landing-hero-cta").textContent).toBe(
      landingText("ar", "hero.cta"),
    );
    expect(screen.queryByText(landingText("en", "hero.title"))).toBeNull();
  });

  it("keeps login links on /auth after choosing Arabic", async () => {
    const user = userEvent.setup();
    renderLanding();
    await user.selectOptions(screen.getByTestId("landing-language-selector"), "ar");
    expect((screen.getByTestId("landing-nav-login") as HTMLAnchorElement).href).toContain(
      "/auth",
    );
  });
});
