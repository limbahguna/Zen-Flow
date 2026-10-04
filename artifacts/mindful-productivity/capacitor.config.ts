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
  ios: {
    // Leave scheme unset so iOS keeps Capacitor's default capacitor:// URL.
    // androidScheme remains https for the Android edge-to-edge WebView.
  },
};

export default config;
