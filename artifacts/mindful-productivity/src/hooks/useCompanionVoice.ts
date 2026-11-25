import { useCallback, useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  beginListening,
  detectVoiceInput,
  endListening,
  readAloudEnabled,
  shouldSpeakReply,
  speakCompanionText,
  stopCompanionSpeech,
  webVoiceInputSupported,
  writeReadAloudEnabled,
} from "@/lib/companionVoice";

export function useCompanionVoice(options: {
  language: string;
  userId: string;
  disabled: boolean;
}) {
  const { language, userId, disabled } = options;
  const [supported, setSupported] = useState(webVoiceInputSupported);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [readAloud, setReadAloudState] = useState(() => readAloudEnabled(userId));

  const stopSpeaking = useCallback(() => {
    setSpeakingId(null);
    void stopCompanionSpeech();
  }, []);

  useEffect(() => {
    setReadAloudState(readAloudEnabled(userId));
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    void detectVoiceInput().then((available) => {
      if (!cancelled) setSupported(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    void stopCompanionSpeech();
    void endListening();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) stopSpeaking();
    }).then((handle) => {
      remove = () => {
        void handle.remove();
      };
    });
    return () => remove?.();
  }, [stopSpeaking]);

  useEffect(() => {
    if (!recording) return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const setReadAloud = useCallback((enabled: boolean) => {
    setReadAloudState(enabled);
    writeReadAloudEnabled(userId, enabled);
    if (!enabled) stopSpeaking();
  }, [stopSpeaking, userId]);

  const toggleRecording = useCallback(async (onTranscript: (text: string) => void) => {
    if (disabled) return;
    setFailed(false);
    if (recording) {
      const text = (await endListening()).trim();
      setRecording(false);
      if (text) onTranscript(text);
      else setFailed(true);
      return;
    }
    stopSpeaking();
    const result = await beginListening(language, () => undefined);
    if (result === "denied") {
      setPermissionDenied(true);
      return;
    }
    if (result !== "ok") {
      setFailed(true);
      return;
    }
    setPermissionDenied(false);
    setRecording(true);
  }, [disabled, language, recording, stopSpeaking]);

  const speak = useCallback(async (text: string, messageId: string, crisisOpen: boolean) => {
    if (!shouldSpeakReply({ readAloud, crisisOpen, text })) return;
    setSpeakingId(messageId);
    const spoke = await speakCompanionText(text, language);
    setSpeakingId((current) => (current === messageId || !spoke ? null : current));
  }, [language, readAloud]);

  return {
    supported,
    recording,
    elapsed,
    permissionDenied,
    failed,
    speakingId,
    readAloud,
    setReadAloud,
    toggleRecording,
    speak,
    stopSpeaking,
  };
}
