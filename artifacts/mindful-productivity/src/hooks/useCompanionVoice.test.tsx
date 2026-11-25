import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { useCompanionVoice } from "./useCompanionVoice";

class FakeRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start() {}
  stop() {
    this.onresult?.({ results: [[{ transcript: "a calm note" }]] });
    this.onend?.();
  }
}

function Probe() {
  const [value, setValue] = useState("");
  const voice = useCompanionVoice({ language: "en", userId: "voice-user", disabled: false });
  return (
    <>
      <button type="button" data-testid="mic" onClick={() => void voice.toggleRecording(setValue)}>
        {voice.recording ? "stop" : "start"}
      </button>
      <textarea data-testid="field" value={value} readOnly />
      {voice.failed && <p data-testid="failed">failed</p>}
    </>
  );
}

describe("useCompanionVoice", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lands a transcript in the field and stops speech on unmount", async () => {
    const cancel = vi.fn();
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    vi.stubGlobal("speechSynthesis", {
      cancel,
      getVoices: () => [],
      speak: vi.fn(),
    });
    const user = userEvent.setup();
    const view = render(<Probe />);
    await user.click(screen.getByTestId("mic"));
    await waitFor(() => expect(screen.getByTestId("mic").textContent).toBe("stop"));
    await user.click(screen.getByTestId("mic"));
    await waitFor(() => expect((screen.getByTestId("field") as HTMLTextAreaElement).value).toBe("a calm note"));
    view.unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("shows a fallback when recognition fails", async () => {
    class BrokenRecognition extends FakeRecognition {
      start() {
        throw new Error("no-speech");
      }
    }
    vi.stubGlobal("SpeechRecognition", BrokenRecognition);
    const user = userEvent.setup();
    render(<Probe />);
    await user.click(screen.getByTestId("mic"));
    expect(screen.getByTestId("failed")).toBeTruthy();
  });
});
