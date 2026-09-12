import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.davidhendrya.mindfulspace",
  appName: "Mindful Space",
  webDir: "dist/public",
  androidScheme: "https",
  android: {
    // Android 15+ renders apps edge-to-edge. Let Capacitor apply the real
    // system-bar insets as WebView margins for both 3-button and gesture nav.
    adjustMarginsForEdgeToEdge: "force",
  },
};

export default config;