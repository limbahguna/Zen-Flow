import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KindEaseMark } from "./KindEaseMark";

describe("KindEaseMark", () => {
  afterEach(() => cleanup());

  it("renders the circle and breath wave as an accessible inline SVG", () => {
    render(<KindEaseMark size={40} title="KindEase" />);
    const mark = screen.getByRole("img", { name: "KindEase" });
    expect(mark.tagName.toLowerCase()).toBe("svg");
    expect(mark.getAttribute("viewBox")).toBe("0 0 1024 1024");
    expect(mark.querySelector("circle")).not.toBeNull();
    expect(mark.querySelector("path")).not.toBeNull();
    expect(mark.querySelector("linearGradient")).not.toBeNull();
  });

  it("uses thicker strokes for small sizes so the mark stays visible", () => {
    render(<KindEaseMark size={40} title="KindEase" />);
    const mark = screen.getByRole("img", { name: "KindEase" });
    expect(mark.querySelector("circle")?.getAttribute("stroke-width")).toBe("44");
    expect(mark.querySelector("path")?.getAttribute("stroke-width")).toBe("52");
  });

  it("renders a dark tile wrapper that fills about 70% with the mark", () => {
    render(<KindEaseMark size={88} variant="tile" title="KindEase" />);
    const tile = screen.getByRole("img", { name: "KindEase" });
    expect(tile.tagName.toLowerCase()).toBe("span");
    expect((tile as HTMLElement).style.width).toBe("88px");
    expect((tile as HTMLElement).style.height).toBe("88px");
    expect((tile as HTMLElement).style.backgroundColor).toMatch(/^(#2F4236|rgb\(\s*47,\s*66,\s*54\s*\))$/i);
    const svg = tile.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("62");
    expect(svg?.getAttribute("height")).toBe("62");
  });
});
