/**
 * KindEase Companion voice. Default speech stays on the device:
 * the Web Speech API in a browser, and the Capacitor community
 * speech-recognition / text-to-speech plugins on Android.
 * Audio is not uploaded and is not stored.
 */

import { Capacitor } from "@capacitor/core";

export const TTS_RATE = 0.9;
export const TTS_PITCH = 0.9;

const SPEECH_LOCALES = {
  en: { primary: "en-US", fallback: "en" },
  id: { primary: "id-ID", fallback: "id" },
  ja: { primary: "ja-JP", fallback: "ja" },
  ar: { primary: "ar-SA", fallback: "ar" },
} as const;

export type CompanionSpeechLanguage = keyof typeof SPEECH_LOCALES;

export function speechLocaleFor(language: string): { primary: string; fallback: string } {
  if (language in SPEECH_LOCALES) return SPEECH_LOCALES[language as CompanionSpeechLanguage];
  return SPEECH_LOCALES.en;
}

export function chooseSpeechLocale(language: string, available?: string[] | null): string {
  const { primary, fallback } = speechLocaleFor(language);
  if (!available?.length) return primary;
  const tags = available.map((tag) => tag.toLowerCase().replaceAll("_", "-"));
  if (tags.includes(primary.toLowerCase())) return primary;
  if (tags.some((tag) => tag === fallback || tag.startsWith(`${fallback}-`))) return fallback;
  return primary;
}

export interface SpeechVoiceOption {
  lang: string;
  name?: string;
  voiceURI?: string;
}

export function pickSpeechVoice(voices: SpeechVoiceOption[], language: string): SpeechVoiceOption | null {
  const { primary, fallback } = speechLocaleFor(language);
  const norm = (lang: string) => lang.toLowerCase().replaceAll("_", "-");
  const exact = voices.find((voice) => norm(voice.lang) === primary.toLowerCase());
  if (exact) return exact;
  return voices.find((voice) => {
    const lang = norm(voice.lang);
    return lang === fallback || lang.startsWith(`${fallback}-`);
  }) ?? null;
}

/** Arabic with no matching voice is left as text. Other languages may use the engine default. */
export function canSpeakLanguage(language: string, voices: SpeechVoiceOption[]): boolean {
  if (language !== "ar") return true;
  return pickSpeechVoice(voices, "ar") != null;
}

export function readAloudStorageKey(userId: string): string {
  return `kindease_coach_read_aloud_${userId || "local"}`;
}

export function readAloudEnabled(userId: string): boolean {
  try {
    return localStorage.getItem(readAloudStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function writeReadAloudEnabled(userId: string, enabled: boolean): void {
  try {
    localStorage.setItem(readAloudStorageKey(userId), enabled ? "1" : "0");
  } catch {
    // Private mode can block storage. The toggle still works for this visit.
  }
}

export function shouldSpeakReply(input: {
  readAloud: boolean;
  crisisOpen: boolean;
  text: string;
}): boolean {
  return input.readAloud && !input.crisisOpen && input.text.trim().length > 0;
}

export function formatVoiceElapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

type RecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type WebRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type RecognitionCtor = new () => WebRecognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export function webVoiceInputSupported(): boolean {
  return recognitionCtor() != null;
}

let activeRecognition: WebRecognition | null = null;
let latestTranscript = "";

export function startWebRecognition(
  locale: string,
  onPartial: (text: string) => void,
): Promise<void> {
  const Ctor = recognitionCtor();
  if (!Ctor) return Promise.reject(new Error("unsupported"));
  stopWebRecognition();
  const recognition = new Ctor();
  recognition.lang = locale;
  recognition.continuous = true;
  recognition.interimResults = true;
  latestTranscript = "";
  recognition.onresult = (event) => {
    let text = "";
    for (let index = 0; index < event.results.length; index += 1) {
      text += event.results[index]?.[0]?.transcript ?? "";
    }
    latestTranscript = text.trim();
    onPartial(latestTranscript);
  };
  activeRecognition = recognition;
  return new Promise((resolve, reject) => {
    recognition.onerror = (event) => {
      const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
      if (denied) reject(new Error("denied"));
    };
    try {
      recognition.start();
      resolve();
    } catch (error) {
      activeRecognition = null;
      reject(error);
    }
  });
}

export function stopWebRecognition(): string {
  const recognition = activeRecognition;
  activeRecognition = null;
  if (!recognition) return latestTranscript;
  try {
    recognition.stop();
  } catch {
    recognition.abort?.();
  }
  return latestTranscript;
}

export function abortWebRecognition(): void {
  latestTranscript = "";
  const recognition = activeRecognition;
  activeRecognition = null;
  try {
    recognition?.abort?.();
    recognition?.stop();
  } catch {
    // Already stopped.
  }
}

async function webVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  const existing = synth.getVoices();
  if (existing.length > 0) return existing;
  return new Promise((resolve) => {
    const finish = () => resolve(synth.getVoices());
    synth.addEventListener?.("voiceschanged", finish, { once: true });
    window.setTimeout(finish, 300);
  });
}

export async function speakWithWebSpeech(text: string, language: string): Promise<boolean> {
  const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return false;
  const voices = await webVoices();
  if (!canSpeakLanguage(language, voices)) return false;
  const match = pickSpeechVoice(voices, language);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = TTS_RATE;
  utterance.pitch = TTS_PITCH;
  utterance.lang = match?.lang ?? chooseSpeechLocale(language);
  const nativeVoice = match
    ? voices.find((voice) => voice.lang === match.lang && voice.name === match.name)
    : undefined;
  if (nativeVoice) utterance.voice = nativeVoice;
  synth.cancel();
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.setTimeout(finish, 60_000);
    synth.speak(utterance);
  });
  return true;
}

export function stopWebSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Synthesis can be missing in a WebView.
  }
}

async function nativeLocale(language: string): Promise<string> {
  try {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const result = await SpeechRecognition.getSupportedLanguages();
    const languages = (result.languages ?? []).map((item) => String(item));
    return chooseSpeechLocale(language, languages);
  } catch {
    return chooseSpeechLocale(language);
  }
}

let nativePartial = "";

export async function beginListening(
  language: string,
  onPartial: (text: string) => void,
): Promise<"ok" | "denied" | "unavailable"> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      const available = await SpeechRecognition.available();
      if (!available.available) return "unavailable";
      const current = await SpeechRecognition.checkPermissions();
      if (current.speechRecognition !== "granted") {
        if (current.speechRecognition === "denied") return "denied";
        const next = await SpeechRecognition.requestPermissions();
        if (next.speechRecognition !== "granted") return "denied";
      }
      nativePartial = "";
      await SpeechRecognition.removeAllListeners();
      await SpeechRecognition.addListener("partialResults", (data) => {
        const text = (data.matches ?? []).join(" ").trim();
        if (!text) return;
        nativePartial = text;
        onPartial(text);
      });
      await SpeechRecognition.start({
        language: await nativeLocale(language),
        maxResults: 1,
        partialResults: true,
        popup: false,
      });
      return "ok";
    } catch {
      return "unavailable";
    }
  }

  if (!webVoiceInputSupported()) return "unavailable";
  try {
    await startWebRecognition(chooseSpeechLocale(language), onPartial);
    return "ok";
  } catch (error) {
    return error instanceof Error && error.message === "denied" ? "denied" : "unavailable";
  }
}

export async function endListening(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
      await SpeechRecognition.stop();
      await SpeechRecognition.removeAllListeners();
    } catch {
      // The transcript captured so far is still usable.
    }
    return nativePartial.trim();
  }
  return stopWebRecognition();
}

export async function speakCompanionText(text: string, language: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (Capacitor.isNativePlatform()) {
    try {
      const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
      const { voices } = await TextToSpeech.getSupportedVoices();
      if (!canSpeakLanguage(language, voices)) return false;
      const match = pickSpeechVoice(voices, language);
      const index = match ? voices.findIndex((voice) => voice.lang === match.lang && voice.name === match.name) : -1;
      await TextToSpeech.speak({
        text: trimmed,
        lang: match?.lang ?? chooseSpeechLocale(language),
        rate: TTS_RATE,
        pitch: TTS_PITCH,
        voice: index >= 0 ? index : undefined,
      });
      return true;
    } catch {
      return false;
    }
  }
  return speakWithWebSpeech(trimmed, language);
}

export async function stopCompanionSpeech(): Promise<void> {
  stopWebSpeech();
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    await TextToSpeech.stop();
  } catch {
    // Leaving the page should stay quiet even if the engine is already idle.
  }
}

export async function detectVoiceInput(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return webVoiceInputSupported();
  try {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const result = await SpeechRecognition.available();
    return result.available;
  } catch {
    return false;
  }
}
