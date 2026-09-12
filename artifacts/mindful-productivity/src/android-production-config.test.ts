import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Android production connectivity configuration", () => {
  it("builds against canonical HTTPS services only", () => {
    const androidEnv = read(".env.android");
    const viteConfig = read("vite.config.ts");

    expect(androidEnv).toContain(
      "VITE_API_BASE_URL=https://getmindfulspace.com",
    );
    expect(androidEnv).not.toContain("replit.app");
    expect(viteConfig).toContain(
      'apiUrl.origin !== "https://getmindfulspace.com"',
    );
    expect(viteConfig).toContain('supabaseUrl.protocol !== "https:"');
  });

  it("keeps cleartext disabled and native origins allowed by CORS", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    const apiApp = read("../api-server/src/app.ts");

    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(apiApp).toContain('"capacitor://localhost"');
    expect(apiApp).toContain('"http://localhost"');
    expect(apiApp).toContain('"https://localhost"');
  });

  it("preserves the Android app ID and auth callback", () => {
    const gradle = read("android/app/build.gradle");
    const manifest = read("android/app/src/main/AndroidManifest.xml");

    expect(gradle).toContain(
      'applicationId "com.davidhendrya.mindfulspace"',
    );
    expect(manifest).toContain(
      'android:scheme="com.davidhendrya.mindfulspace"',
    );
    expect(manifest).toContain('android:host="auth"');
    expect(manifest).toContain('android:path="/callback"');
  });
});