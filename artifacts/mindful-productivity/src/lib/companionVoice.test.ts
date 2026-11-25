import { describe, expect, it, vi } from "vitest";
import {
  canSpeakLanguage,
  chooseSpeechLocale,
  formatVoiceElapsed,
  pickSpeechVoice,
  shouldSpeakReply,
  speechLocaleFor,
  startWebRecognition,
  stopWebRecognition,
  TTS_PITCH,
  TTS_RATE,
} from "./companionVoice";

describe("companion voice locales", () => {
  it("maps app languages to speech tags and falls back to the short code", () => {
    expect(speechLocaleFor("en")).toEqual({ primary: "en-US", fallback: "en" });
    expect(speechLocaleFor("id")).toEqual({ primary: "id-ID", fallback: "id" });
    expect(speechLocaleFor("ja")).toEqual({ primary: "ja-JP", fallback: "ja" });
    expect(speechLocaleFor("ar")).toEqual({ primary: "ar-SA", fallback: "ar" });
    expect(chooseSpeechLocale("ja", ["en-US", "ja"])).toBe("ja");
    expect(chooseSpeechLocale("ar", ["ar-SA", "en-US"])).toBe("ar-SA");
    expect(chooseSpeechLocale("id", [])).toBe("id-ID");
  });

  it("picks a matching voice and skips spoken Arabic when none exists", () => {
    const voices = [
      { lang: "en-US", name: "Samantha" },
      { lang: "id-ID", name: "Damayanti" },
    ];
    expect(pickSpeechVoice(voices, "id")?.name).toBe("Damayanti");
    expect(pickSpeechVoice(voices, "ar")).toBeNull();
    expect(canSpeakLanguage("ar", voices)).toBe(false);
    expect(canSpeakLanguage("ja", voices)).toBe(true);
    expect(TTS_RATE).toBe(0.9);
    expect(TTS_PITCH).toBe(0.9);
  });

  it("does not speak crisis or empty replies, and only when read-aloud is on", () => {
    expect(shouldSpeakReply({ readAloud: false, crisisOpen: false, text: "Hello" })).toBe(false);
    expect(shouldSpeakReply({ readAloud: true, crisisOpen: true, text: "Hello" })).toBe(false);
    expect(shouldSpeakReply({ readAloud: true, crisisOpen: false, text: "   " })).toBe(false);
    expect(shouldSpeakReply({ readAloud: true, crisisOpen: false, text: "Hello" })).toBe(true);
    expect(formatVoiceElapsed(65)).toBe("1:05");
  });
});

describe("web recognition", () => {
  it("puts the transcript in place when recording stops", async () => {
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null = null;
      onerror: ((event: { error?: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {}
      stop() {
        this.onresult?.({ results: [[{ transcript: "hello there" }]] });
        this.onend?.();
      }
    }
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    const seen: string[] = [];
    await startWebRecognition("en-US", (text) => seen.push(text));
    expect(stopWebRecognition()).toBe("hello there");
    expect(seen).toEqual(["hello there"]);
    vi.unstubAllGlobals();
  });
});
