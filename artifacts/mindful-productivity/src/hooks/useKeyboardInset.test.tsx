import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useKeyboardInset } from "./useKeyboardInset";

type ViewportStub = {
  height: number;
  offsetTop: number;
  emit: (type: string) => void;
};

function installViewport(): ViewportStub {
  const handlers = new Map<string, Set<EventListener>>();
  const viewport = {
    height: 800,
    offsetTop: 0,
    addEventListener(type: string, callback: EventListener) {
      const set = handlers.get(type) ?? new Set<EventListener>();
      set.add(callback);
      handlers.set(type, set);
    },
    removeEventListener(type: string, callback: EventListener) {
      handlers.get(type)?.delete(callback);
    },
    emit(type: string) {
      handlers.get(type)?.forEach((callback) => callback(new Event(type)));
    },
  };
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  return viewport;
}

function Probe() {
  const { inset, open } = useKeyboardInset();
  return <output data-testid="keyboard-probe" data-open={String(open)}>{inset}</output>;
}

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--keyboard-inset");
  document.documentElement.classList.remove("keyboard-open");
  Reflect.deleteProperty(window, "visualViewport");
});

describe("useKeyboardInset", () => {
  it("sets --keyboard-inset from a mocked visualViewport", async () => {
    const viewport = installViewport();
    render(<Probe />);

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--keyboard-inset")).toBe("0px");
    });
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(false);
    expect(screen.getByTestId("keyboard-probe").textContent).toBe("0");

    viewport.height = 470;
    viewport.offsetTop = 30;
    viewport.emit("resize");

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--keyboard-inset")).toBe("300px");
    });
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(true);
    expect(screen.getByTestId("keyboard-probe").textContent).toBe("300");
    expect(screen.getByTestId("keyboard-probe").getAttribute("data-open")).toBe("true");

    viewport.height = 900;
    viewport.offsetTop = 0;
    viewport.emit("scroll");

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue("--keyboard-inset")).toBe("0px");
    });
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(false);
  });
});
