import type { CapacitorConfig } from "@capacitor/cli";

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
};

export default config;