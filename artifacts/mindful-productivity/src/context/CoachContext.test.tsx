import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CoachProvider,
  useCoachContext,
  type CoachMessage,
} from "./CoachContext";

const USER_MESSAGE: CoachMessage = {
  id: "message-a",
  role: "user",
  content: "private message from user A",
};

function TranscriptProbe() {
  const { messages, setMessages } = useCoachContext();
  return (
    <>
      <div data-testid="transcript">
        {messages.map((message) => message.content).join("|")}
      </div>
      <button type="button" onClick={() => setMessages([USER_MESSAGE])}>
        add message
      </button>
    </>
  );
}

describe("CoachContext account isolation", () => {
  afterEach(cleanup);

  it("never renders the previous user's transcript after an account change", () => {
    const { rerender } = render(
      <CoachProvider key="user-a" userId="user-a">
        <TranscriptProbe />
      </CoachProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "add message" }));
    expect(screen.getByTestId("transcript").textContent).toContain("user A");

    rerender(
      <CoachProvider key="user-b" userId="user-b">
        <TranscriptProbe />
      </CoachProvider>,
    );
    expect(screen.getByTestId("transcript").textContent).toBe("");

    rerender(
      <CoachProvider key="user-a-returned" userId="user-a">
        <TranscriptProbe />
      </CoachProvider>,
    );
    expect(screen.getByTestId("transcript").textContent).toBe("");
  });

  it("does not persist conversation content in shared browser storage", () => {
    const contextSource = readFileSync(
      resolve(process.cwd(), "src/context/CoachContext.tsx"),
      "utf8",
    );
    const coachSource = readFileSync(
      resolve(process.cwd(), "src/pages/coach.tsx"),
      "utf8",
    );

    expect(contextSource).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(coachSource).not.toContain('setItem("coach_chat_history"');
  });
});