import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_PRODUCTION_API_ORIGIN,
  resolveBuildTimeApiBaseUrl,
} from "./lib/apiBaseUrl";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Android production connectivity configuration", () => {
  it("builds against canonical HTTPS services only", () => {
    const viteConfig = read("vite.config.ts");

    expect(viteConfig).toContain("resolveBuildTimeApiBaseUrl");
    expect(viteConfig).toContain("import.meta.env.VITE_API_BASE_URL");
    expect(viteConfig).toContain("supabaseUrl.protocol !== \"https:\"");
    expect(
      resolveBuildTimeApiBaseUrl({
        command: "build",
        mode: "android",
        envValue: "http://localhost:8080",
      }),
    ).toBe(CANONICAL_PRODUCTION_API_ORIGIN);
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
