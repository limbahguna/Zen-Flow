/**
 * Tests for MovementSession — video integration.
 *
 * Covers:
 *  1. Each step renders the correct video src
 *  2. Only one video rendered at a time (active step only)
 *  3. Video has muted and playsInline attributes
 *  4. Pause button calls video.pause()
 *  5. Resume button calls video.play()
 *  6. Step change (Next) replaces the video and restarts from beginning
 *  7. Video error shows the correct WebP fallback
 *  8. Reduced motion shows WebP fallback instead of video
 *  9. Stand-and-walk step renders the stand-and-walk video
 * 10. Countdown and completion tracking are unaffected
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MovementSession } from "./MovementSession";

// ── Mock dependencies ─────────────────────────────────────────────────────────

const { localizationState } = vi.hoisted(() => ({
  localizationState: { secondsTemplate: "{n}s" },
}));

vi.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) =>
      key === "movement.session.timer.seconds"
        ? localizationState.secondsTemplate
        : key,
  }),
}));

vi.mock("@/services/reminderService", () => ({
  recordMovementCompletion: vi.fn().mockReturnValue(true),
  hasCompletedMovementToday: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/motivationMessages", () => ({
  todayDateStr: () => "2026-08-18",
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
  };
});

// ── Setup: mock HTMLMediaElement play/pause and matchMedia ────────────────────

beforeEach(() => {
  localizationState.secondsTemplate = "{n}s";
  // Fresh mocks each test so call counts don't bleed across tests
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();

  // matchMedia is absent in jsdom
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSession() {
  const onClose = vi.fn();
  const onComplete = vi.fn();
  return {
    ...render(<MovementSession onClose={onClose} onComplete={onComplete} />),
    onClose,
    onComplete,
  };
}

// ── 1. Step 0 renders the shoulder-rolls video ────────────────────────────────

it("step 0 renders the shoulder-rolls video with the correct src", () => {
  renderSession();
  const video = screen.getByTestId("movement-video") as HTMLVideoElement;
  expect(video.src).toContain("/movements/shoulder-rolls-loop.mp4");
});

// ── 2. Only the active step's video is rendered ───────────────────────────────

it("renders exactly one video element for the active step", () => {
  const { container } = renderSession();
  const videos = container.querySelectorAll("video");
  expect(videos.length).toBe(1);
});

// ── 3. Video attributes: muted and playsInline ────────────────────────────────

it("video element has muted and playsInline attributes", () => {
  renderSession();
  const video = screen.getByTestId("movement-video") as HTMLVideoElement;
  // muted is reflected as a property in jsdom
  expect(video.muted).toBe(true);
  // playsInline maps to the 'playsinline' attribute
  expect(video.hasAttribute("playsinline")).toBe(true);
});

// ── 4. Pause button calls video.pause() ──────────────────────────────────────

it("clicking Pause calls video.pause()", async () => {
  renderSession();
  const video = screen.getByTestId("movement-video") as HTMLVideoElement;
  const pauseBtn = screen.getByTestId("movement-pause-resume");

  await act(async () => {
    fireEvent.click(pauseBtn);
  });

  expect(video.pause).toHaveBeenCalled();
});

// ── 5. Resume button calls video.play() ──────────────────────────────────────

it("clicking Resume after Pause calls video.play()", async () => {
  renderSession();
  const video = screen.getByTestId("movement-video") as HTMLVideoElement;
  const pauseResumeBtn = screen.getByTestId("movement-pause-resume");

  // Pause first
  await act(async () => {
    fireEvent.click(pauseResumeBtn);
  });

  // Clear the call record so we can assert the Resume play() call specifically
  vi.clearAllMocks();
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

  // Resume
  await act(async () => {
    fireEvent.click(pauseResumeBtn);
  });

  expect(video.play).toHaveBeenCalled();
});

// ── 6. Next button advances to step 1 with the neck-stretch video ─────────────

it("clicking Next advances to step 1 and renders the neck-stretch video", async () => {
  renderSession();
  const nextBtn = screen.getByTestId("movement-next");

  await act(async () => {
    fireEvent.click(nextBtn);
  });

  const video = screen.getByTestId("movement-video") as HTMLVideoElement;
  expect(video.src).toContain("/movements/neck-stretch-loop.mp4");
});

// ── 7. Video error shows the correct WebP fallback ───────────────────────────

it("when video fires an error event, fallback WebP is shown instead", async () => {
  renderSession();
  const video = screen.getByTestId("movement-video");

  await act(async () => {
    fireEvent.error(video);
  });

  // Video should no longer be present
  expect(screen.queryByTestId("movement-video")).toBeNull();
  // Fallback image should appear with the shoulder-rolls WebP
  const img = screen.getByTestId("movement-fallback-img") as HTMLImageElement;
  expect(img.src).toContain("/movements/shoulder-rolls.webp");
});

// ── 8. Reduced motion shows WebP fallback, no video ──────────────────────────

it("when useReducedMotion() is true, renders WebP fallback instead of video", async () => {
  const fm = await import("framer-motion");
  (fm.useReducedMotion as ReturnType<typeof vi.fn>).mockReturnValueOnce(true);

  renderSession();

  expect(screen.queryByTestId("movement-video")).toBeNull();
  const img = screen.getByTestId("movement-fallback-img") as HTMLImageElement;
  expect(img.src).toContain("/movements/shoulder-rolls.webp");
});

// ── 9. Stand-and-walk step renders the stand-and-walk video ──────────────────

describe("stand-and-walk step (step 2)", () => {
  it("renders stand-and-walk-loop.mp4 after navigating to step 2", async () => {
    renderSession();
    const nextBtn = screen.getByTestId("movement-next");

    // Step 0 → 1; wait for AnimatePresence exit animation to settle
    await act(async () => { fireEvent.click(nextBtn); });
    await waitFor(() =>
      expect(screen.getByTestId("movement-video").getAttribute("src")).toContain("neck-stretch"),
    );

    // Step 1 → 2
    await act(async () => { fireEvent.click(nextBtn); });
    await waitFor(() =>
      expect(screen.getByTestId("movement-video").getAttribute("src")).toContain("stand-and-walk"),
    );
  });
});

// ── 10. Countdown timer and completion tracking are unaffected ────────────────

it("initial timer displays 45s for step 0", () => {
  renderSession();
  expect(screen.getByTestId("movement-timer").textContent).toBe("45s");
});

it("localizes the sub-minute timer unit for EN, ID, and JA without resetting the session", () => {
  const onClose = vi.fn();
  const { rerender } = render(<MovementSession onClose={onClose} />);

  expect(screen.getByTestId("movement-timer").textContent).toBe("45s");

  localizationState.secondsTemplate = "{n} dtk";
  rerender(<MovementSession onClose={onClose} />);
  expect(screen.getByTestId("movement-timer").textContent).toBe("45 dtk");

  localizationState.secondsTemplate = "{n}秒";
  rerender(<MovementSession onClose={onClose} />);
  expect(screen.getByTestId("movement-timer").textContent).toBe("45秒");
});

it("clicking Complete on the last step calls onComplete and shows done screen", async () => {
  const { onComplete } = renderSession();
  const nextBtn = screen.getByTestId("movement-next");

  // Navigate to last step (step 4)
  for (let i = 0; i < 4; i++) {
    await act(async () => { fireEvent.click(nextBtn); });
  }

  const completeBtn = screen.getByTestId("movement-complete");
  await act(async () => {
    fireEvent.click(completeBtn);
  });

  expect(onComplete).toHaveBeenCalledOnce();
  // Done screen replaces the session
  expect(screen.queryByTestId("movement-video")).toBeNull();
  expect(screen.queryByTestId("movement-timer")).toBeNull();
});
