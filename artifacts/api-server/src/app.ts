import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { mountFrontend, resolveAdjacentPublicDir } from "./frontendStatic";

export function createApp(options: { publicDir?: string | null } = {}): Express {
  const app: Express = express();

  // ── CORS ──────────────────────────────────────────────────────────────────────
  // We must NOT use Access-Control-Allow-Origin: * because requests carry an
  // Authorization header, which browsers block under the wildcard rule.
  //
  // Same-origin requests (origin === undefined) are always allowed — this covers
  // web users whose frontend and API share the same domain on Replit deployment.
  //
  // Cross-origin cases that need explicit allowance:
  //   - Capacitor Android/iOS:  capacitor://localhost
  //   - Local dev / emulator:   http://localhost, https://localhost
  //   - Canonical production domains: getmindfulspace.com and www
  //   - Additional production domains: set via CORS_ALLOWED_ORIGINS env var
  //   - Replit Preview (dev only): https://<anything>.replit.dev
  //
  // Set CORS_ALLOWED_ORIGINS to a comma-separated list of origins in Replit Secrets.

  /**
   * Returns true when the origin is the Replit Preview proxy in development.
   *
   * Requirements:
   *   - Only active when NODE_ENV === "development"
   *   - Scheme must be HTTPS (never HTTP)
   *   - Hostname must end with ".replit.dev" (dot-prefixed), so a bare
   *     "evilreplit.dev" cannot match — it needs at least one subdomain label
   *     before ".replit.dev"
   *   - No wildcards are used; each request's actual origin is validated
   */
  function isReplitDevPreview(origin: string): boolean {
    if (process.env.NODE_ENV !== "development") return false;
    try {
      const url = new URL(origin);
      return url.protocol === "https:" && url.hostname.endsWith(".replit.dev");
    } catch {
      return false;
    }
  }

  const STATIC_ALLOWED = new Set([
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
    "https://getmindfulspace.com",
    "https://www.getmindfulspace.com",
  ]);
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([...STATIC_ALLOWED, ...configuredOrigins]);

  app.use(
    cors({
      origin(origin, callback) {
        // Undefined origin = same-origin request (no CORS header needed)
        if (!origin || allowedOrigins.has(origin) || isReplitDevPreview(origin)) {
          callback(null, true);
        } else {
          // Do not reveal the allowlist in the error — just reject
          callback(new Error("CORS: origin not permitted"));
        }
      },
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", router);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const publicDir =
    options.publicDir === undefined
      ? resolveAdjacentPublicDir(import.meta.url)
      : options.publicDir;
  if (publicDir) {
    mountFrontend(app, publicDir);
  }

  return app;
}

const app = createApp();
export default app;
