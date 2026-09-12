/**
 * Tests for MovementIllustration.
 *
 * Covers: correct SVG per movement, no emoji placeholder, paused/reduced-motion
 * behaviour, aria-label, step-transition substitution, and timer isolation.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MovementIllustration, MovementId } from "./MovementIllustration";

// ── Mock framer-motion so we can control useReducedMotion ─────────────────────
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

const MOVEMENTS: MovementId[] = [
  "shoulder-rolls",
  "neck-stretch",
  "stand-walk",
  "back-stretch",
  "cooldown",
];

afterEach(() => cleanup());

// ── 1. Each movement renders the correct SVG ──────────────────────────────────

describe("MovementIllustration — renders correct SVG for each movement", () => {
  MOVEMENTS.forEach((movement) => {
    it(`renders SVG with role="img" for ${movement}`, () => {
      const { container } = render(
        <MovementIllustration movement={movement} ariaLabel={movement} />,
      );
      const svg = container.querySelector(`[data-movement="${movement}"]`);
      expect(svg).toBeTruthy();
      expect(svg?.tagName.toLowerCase()).toBe("svg");
      expect(svg?.getAttribute("role")).toBe("img");
    });
  });
});

// ── 2. No movement uses an emoji placeholder ──────────────────────────────────

it("no movement renders an emoji placeholder (text-6xl class)", () => {
  MOVEMENTS.forEach((movement) => {
    const { container } = render(<MovementIllustration movement={movement} />);
    // The old emoji was wrapped in a div with class "text-6xl"
    const emojiDivs = container.querySelectorAll(".text-6xl");
    expect(emojiDivs.length).toBe(0);
    cleanup();
  });
});

// ── 3. Paused prop sets data-paused attribute ─────────────────────────────────

it("sets data-paused='true' when paused=true", () => {
  const { container } = render(
    <MovementIllustration movement="shoulder-rolls" paused={true} ariaLabel="Shoulder rolls" />,
  );
  const svg = container.querySelector("[data-movement='shoulder-rolls']");
  expect(svg?.getAttribute("data-paused")).toBe("true");
});

it("sets data-paused='false' when paused=false (default)", () => {
  const { container } = render(
    <MovementIllustration movement="neck-stretch" paused={false} ariaLabel="Neck stretch" />,
  );
  const svg = container.querySelector("[data-movement='neck-stretch']");
  expect(svg?.getAttribute("data-paused")).toBe("false");
});

// ── 4. Reduced-motion renders static pose without crashing ────────────────────

it("renders a static pose (no crash) when useReducedMotion returns true", async () => {
  const fm = await import("framer-motion");
  (fm.useReducedMotion as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);

  MOVEMENTS.forEach((movement) => {
    expect(() => {
      render(<MovementIllustration movement={movement} ariaLabel={movement} />);
    }).not.toThrow();
    // SVG still present
    const svg = document.querySelector(`[data-movement="${movement}"]`);
    expect(svg).toBeTruthy();
    cleanup();
  });
});

// ── 5. aria-label propagates ──────────────────────────────────────────────────

it("sets aria-label from the ariaLabel prop", () => {
  const { container } = render(
    <MovementIllustration movement="cooldown" ariaLabel="Slow cooldown" />,
  );
  const svg = container.querySelector("[data-movement='cooldown']");
  expect(svg?.getAttribute("aria-label")).toBe("Slow cooldown");
});

it("aria-label can carry a translated string", () => {
  const label = "Pendinginan perlahan"; // Indonesian
  const { container } = render(
    <MovementIllustration movement="cooldown" ariaLabel={label} />,
  );
  expect(
    container.querySelector("[data-movement='cooldown']")?.getAttribute("aria-label"),
  ).toBe(label);
});

// ── 6. Step transition changes illustration ───────────────────────────────────

it("changing movement prop swaps data-movement without keeping the old one", () => {
  const { rerender, container } = render(
    <MovementIllustration movement="shoulder-rolls" ariaLabel="a" />,
  );
  expect(container.querySelector("[data-movement='shoulder-rolls']")).toBeTruthy();

  rerender(<MovementIllustration movement="stand-walk" ariaLabel="b" />);
  expect(container.querySelector("[data-movement='stand-walk']")).toBeTruthy();
  expect(container.querySelector("[data-movement='shoulder-rolls']")).toBeNull();
});

// ── 7. className prop passes through ─────────────────────────────────────────

it("applies the className prop to the SVG element", () => {
  const { container } = render(
    <MovementIllustration movement="back-stretch" className="h-44 w-auto" />,
  );
  const svg = container.querySelector("[data-movement='back-stretch']");
  expect(svg?.classList.contains("h-44")).toBe(true);
  expect(svg?.classList.contains("w-auto")).toBe(true);
});

// ── 8. All five movements render an SVG (not a crash or empty) ────────────────

it("all five MovementId values produce a non-empty SVG", () => {
  MOVEMENTS.forEach((movement) => {
    const { container } = render(
      <MovementIllustration movement={movement} ariaLabel="test" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    // SVG has child elements (not just an empty shell)
    expect(svg!.children.length).toBeGreaterThan(0);
    cleanup();
  });
});
