import { useEffect, useState } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";

type InsetListener = (inset: number) => void;

const listeners = new Set<InsetListener>();
let stopListening: (() => void) | null = null;
let starting = false;
let generation = 0;

function viewportInset(): number {
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
}

function publish(raw: number) {
  const inset = Math.max(0, Math.round(Number.isFinite(raw) ? raw : 0));
  const root = document.documentElement;
  root.style.setProperty("--keyboard-inset", `${inset}px`);
  root.classList.toggle("keyboard-open", inset > 0);
  listeners.forEach((listener) => listener(inset));
  if (inset > 0) {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active !== document.body &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)
      ) {
        active.scrollIntoView?.({ block: "center" });
      }
    });
  }
}

function listenToViewport(): () => void {
  const viewport = window.visualViewport;
  if (!viewport) return () => undefined;
  const onChange = () => publish(viewportInset());
  viewport.addEventListener("resize", onChange);
  viewport.addEventListener("scroll", onChange);
  onChange();
  return () => {
    viewport.removeEventListener("resize", onChange);
    viewport.removeEventListener("scroll", onChange);
  };
}

async function listenToNative(): Promise<() => void> {
  const { Keyboard } = await import("@capacitor/keyboard");
  const handles: PluginListenerHandle[] = await Promise.all([
    Keyboard.addListener("keyboardWillShow", (info) => publish(info.keyboardHeight)),
    Keyboard.addListener("keyboardDidShow", (info) => publish(info.keyboardHeight)),
    Keyboard.addListener("keyboardWillHide", () => publish(0)),
    Keyboard.addListener("keyboardDidHide", () => publish(0)),
  ]);
  return () => {
    handles.forEach((handle) => {
      void handle.remove();
    });
  };
}

function ensureStarted() {
  if (stopListening || starting) return;
  const current = ++generation;
  if (!Capacitor.isNativePlatform()) {
    stopListening = listenToViewport();
    return;
  }
  starting = true;
  void listenToNative()
    .then((stop) => {
      if (current !== generation) {
        stop();
        return;
      }
      stopListening = stop;
    })
    .catch(() => {
      if (current === generation && !stopListening) stopListening = listenToViewport();
    })
    .finally(() => {
      if (current === generation) starting = false;
    });
}

function ensureStopped() {
  generation += 1;
  starting = false;
  stopListening?.();
  stopListening = null;
  document.documentElement.style.removeProperty("--keyboard-inset");
  document.documentElement.classList.remove("keyboard-open");
}

/** Tracks the on-screen keyboard and publishes `--keyboard-inset` on `<html>`. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    listeners.add(setInset);
    ensureStarted();
    return () => {
      listeners.delete(setInset);
      if (listeners.size === 0) ensureStopped();
    };
  }, []);

  return { inset, open: inset > 0 };
}
