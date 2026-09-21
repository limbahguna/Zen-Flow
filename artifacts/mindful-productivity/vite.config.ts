import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { resolveBuildTimeApiBaseUrl } from "./src/lib/apiBaseUrl";

// PORT is only required when running the dev/preview server.
// During `vite build`, PORT is never read so the build works without env vars.
// BASE_PATH defaults to "/" for standalone / Capacitor builds.

export default defineConfig(async ({ command, mode }) => {
  const isBuild = command === "build";
  const root = path.resolve(import.meta.dirname);
  const buildEnv = loadEnv(mode, root, "");

  const resolvedApiBaseUrl = resolveBuildTimeApiBaseUrl({
    command,
    mode,
    envValue: process.env.VITE_API_BASE_URL || buildEnv.VITE_API_BASE_URL,
  });
  process.env.VITE_API_BASE_URL = resolvedApiBaseUrl;

  if (isBuild && mode === "android") {
    const supabaseProjectUrl = process.env.VITE_SUPABASE_URL || buildEnv.VITE_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.VITE_SUPABASE_ANON_KEY || buildEnv.VITE_SUPABASE_ANON_KEY;
    if (!supabaseProjectUrl) {
      throw new Error("Android builds require API and Supabase project URLs.");
    }
    const supabaseUrl = new URL(supabaseProjectUrl);
    if (
      supabaseUrl.protocol !== "https:" ||
      !supabaseUrl.hostname.endsWith(".supabase.co") ||
      supabaseUrl.hostname.includes("localhost") ||
      supabaseUrl.hostname.includes("replit")
    ) {
      throw new Error("Android builds require a valid HTTPS Supabase project URL.");
    }
    if (!supabaseAnonKey) {
      throw new Error("Android builds require the Supabase anonymous key.");
    }
  }

  const rawPort = process.env.PORT;
  if (!isBuild && !rawPort) {
    throw new Error("PORT environment variable is required for the dev server.");
  }
  const port = rawPort ? Number(rawPort) : 3000;
  if (rawPort && (Number.isNaN(port) || port <= 0)) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  // BASE_PATH defaults to "/" — works for Capacitor, PWABuilder, and standalone
  const basePath = process.env.BASE_PATH ?? "/";

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      ...(!isBuild ? [runtimeErrorOverlay()] : []),
      // ── Capacitor Android WebView compatibility ──────────────────────────────
      // Vite emits `crossorigin` on <link rel="stylesheet"> tags to enable
      // subresource integrity checking. However, Capacitor's WebViewAssetLoader
      // serves local assets without CORS response headers.  When `crossorigin`
      // is present, the WebView makes a CORS-mode fetch and blocks the stylesheet
      // because there is no Access-Control-Allow-Origin header — resulting in the
      // app rendering unstyled HTML.  The regex targets only <link rel="stylesheet">
      // so that <link rel="preconnect" crossorigin> (needed for Google Fonts) and
      // <script type="module" crossorigin> (needed for ES module loading) are left
      // untouched.
      ...(mode === "android"
        ? [
            {
              name: "capacitor-android-css-fix",
              transformIndexHtml(html: string): string {
                // Remove crossorigin only from stylesheet <link> tags.
                return html.replace(
                  /(<link\b[^>]*?\brel="stylesheet"[^>]*?)\s+crossorigin\b([^>]*?>)/g,
                  "$1$2",
                );
              },
            },
          ]
        : []),
      ...(!isBuild &&
      process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets",
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    root,
    define: {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(resolvedApiBaseUrl),
    },
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: { strict: true },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
