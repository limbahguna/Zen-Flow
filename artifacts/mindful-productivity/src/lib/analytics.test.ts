import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./analytics";

describe("trackEvent", () => {
  afterEach(() => {
    delete window.umami;
  });

  it("forwards an event and privacy-safe dimensions to Umami", () => {
    const track = vi.fn();
    window.umami = { track };

    trackEvent("task_completed", { workflow: "woop" });

    expect(track).toHaveBeenCalledWith("task_completed", {
      workflow: "woop",
    });
  });

  it("is a safe no-op when analytics is unavailable", () => {
    expect(() => trackEvent("task_completed")).not.toThrow();
  });

  it("does not let analytics failures break the app", () => {
    window.umami = {
      track: () => {
        throw new Error("tracker unavailable");
      },
    };

    expect(() => trackEvent("task_completed")).not.toThrow();
  });
});