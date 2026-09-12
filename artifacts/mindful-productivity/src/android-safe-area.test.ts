import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Android edge-to-edge safe area", () => {
  it("enables safe-area environment variables in the viewport", () => {
    const html = readProjectFile("index.html");
    expect(html).toContain("viewport-fit=cover");
  });

  it("uses one safe-area layer for main and onboarding bottom actions", () => {
    const css = readProjectFile("src/index.css");
    const onboarding = readProjectFile("src/components/OnboardingFlow.tsx");
    const setup = readProjectFile("src/pages/setup.tsx");

    expect(css).toContain("--app-safe-area-bottom: env(safe-area-inset-bottom, 0px)");
    expect(css).toContain(".bottom-nav");
    expect(css).toContain(".onboarding-bottom-actions");
    expect(onboarding).toContain('data-testid="onboarding-bottom-actions"');
    expect(setup).toContain('data-testid="setup-bottom-actions"');
  });

  it("uses Capacitor's native edge-to-edge margin handler without double inset", () => {
    const config = readProjectFile("capacitor.config.ts");
    const css = readProjectFile("src/index.css");
    const html = readProjectFile("index.html");
    const runtime = readProjectFile("src/lib/native.ts");

    expect(config).toContain('adjustMarginsForEdgeToEdge: "force"');
    expect(css).toContain("html.capacitor-native");
    expect(css).toMatch(
      /html\.capacitor-native\s*\{[\s\S]*--app-safe-area-bottom:\s*0px/,
    );
    expect(runtime).toContain(
      'document.documentElement.classList.toggle("capacitor-native", native)',
    );
    expect(html).toContain(
      'document.documentElement.classList.add("capacitor-native")',
    );
  });

  it("paints every root layer dark without reserving space above the dashboard hero", () => {
    const html = readProjectFile("index.html");
    const css = readProjectFile("src/index.css");
    const app = readProjectFile("src/App.tsx");
    const dashboard = readProjectFile("src/pages/dashboard.tsx");

    expect(html).toMatch(/html,\s*body,\s*#root\s*\{[\s\S]*background:\s*#1A1E1A/);
    expect(css).toMatch(
      /html,\s*body,\s*#root\s*\{[\s\S]*background-color:\s*#1A1E1A/,
    );
    expect(css).toMatch(
      /#root,\s*\.app-shell\s*\{[\s\S]*background-color:\s*#1A1E1A/,
    );
    expect(app).toContain('<div className="app-shell">');

    const dashboardStart = dashboard.indexOf('className="min-h-screen bg-[#1A1E1A] pb-24"');
    const heroStart = dashboard.indexOf('data-testid="dashboard-hero"', dashboardStart);
    const mainStart = dashboard.indexOf("<main", heroStart);
    const beforeHero = dashboard.slice(dashboardStart, heroStart);
    const beforeMain = dashboard.slice(heroStart, mainStart);

    expect(dashboardStart).toBeGreaterThan(-1);
    expect(heroStart).toBeGreaterThan(dashboardStart);
    expect(beforeHero).not.toMatch(/<(img|iframe|header|picture|video)\b/);
    expect(beforeMain).not.toMatch(/<(img|iframe|header|picture|video)\b/);
  });

  it("uses a dark no-action-bar theme and disables native WebView selection panels", () => {
    const manifest = readProjectFile("android/app/src/main/AndroidManifest.xml");
    const styles = readProjectFile("android/app/src/main/res/values/styles.xml");
    const activity = readProjectFile(
      "android/app/src/main/java/com/davidhendrya/mindfulspace/MainActivity.java",
    );
    const coach = readProjectFile("src/pages/coach.tsx");

    expect(manifest).toContain('android:theme="@style/AppTheme.NoActionBar"');
    expect(styles).not.toContain("Theme.AppCompat.Light.DarkActionBar");
    expect(styles).toContain(
      '<item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>',
    );
    expect(activity).toContain("webView.setBackgroundColor(APP_BACKGROUND)");
    expect(activity).toContain("webView.setLongClickable(false)");
    expect(activity).toContain("webView.setOnLongClickListener(view -> true)");
    expect(coach).toContain("<textarea");
    expect(coach).toContain('className="coach-composer');
  });

  it("preserves the production application ID", () => {
    const config = readProjectFile("capacitor.config.ts");
    const gradle = readProjectFile("android/app/build.gradle");
    const supabase = readProjectFile("src/lib/supabase.ts");
    expect(config).toContain('appId: "com.davidhendrya.mindfulspace"');
    expect(gradle).toContain(
      'applicationId "com.davidhendrya.mindfulspace"',
    );
    expect(supabase).toContain('flowType: "pkce"');
  });
});