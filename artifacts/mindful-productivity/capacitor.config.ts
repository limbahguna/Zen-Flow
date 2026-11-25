import type { CapacitorConfig } from "@capacitor/cli";
import "@capacitor/keyboard";

const config: CapacitorConfig = {
  appId: "com.davidhendrya.mindfulspace",
  appName: "KindEase",
  webDir: "dist/public",
  androidScheme: "https",
  server: {
    // Keep appId unchanged. Allow WebView navigation to the public site
    // (and legacy brand host during DNS cutover).
    allowNavigation: [
      "kindease.app",
      "www.kindease.app",
      "getmindfulspace.com",
      "www.getmindfulspace.com",
    ],
  },
  android: {
    // Android 15+ renders apps edge-to-edge. Let Capacitor apply the real
    // system-bar insets as WebView margins for both 3-button and gesture nav.
    adjustMarginsForEdgeToEdge: "force",
  },
  plugins: {
    // The WebView does not shrink under the keyboard on Android 15+ edge-to-edge.
    // Layout is shifted with the --keyboard-inset CSS variable instead.
    Keyboard: {
      resize: "none",
      resizeOnFullScreen: true,
    },
  },
};

export default config;