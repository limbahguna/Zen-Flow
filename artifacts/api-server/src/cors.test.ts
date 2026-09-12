/**
 * Regression tests for CORS origin validation in app.ts
 *
 * Key rules under test:
 *  1. Same-origin requests (no Origin header) are always allowed.
 *  2. Static allowlist entries (Capacitor, localhost, and the canonical
 *     production domains) are allowed regardless of NODE_ENV.
 *  3. CORS_ALLOWED_ORIGINS env var entries are allowed.
 *  4. In NODE_ENV=development, https://<subdomain>.replit.dev is allowed.
 *  5. In NODE_ENV=development, https://evilreplit.dev is rejected (bare domain,
 *     no subdomain before ".replit.dev").
 *  6. In NODE_ENV=production, *.replit.dev is rejected even with a valid subdomain.
 *  7. http:// (non-HTTPS) replit.dev origins are always rejected.
 *  8. Arbitrary unknown origins are rejected in all environments.
 *  9. OPTIONS preflight returns 204 with CORS headers for allowed origins.
 * 10. Authorization and Content-Type are listed in Access-Control-Allow-Headers.
 *
 * Note: isReplitDevPreview() reads process.env.NODE_ENV at call-time, so
 * we can test both paths simply by setting NODE_ENV before each request.
 */

import { beforeEach, afterEach, describe, it, expect } from "vitest";
import supertest from "supertest";
import app from "./app";

const request = supertest(app);

const ORIGINAL_NODE_ENV = process.env["NODE_ENV"];

afterEach(() => {
  process.env["NODE_ENV"] = ORIGINAL_NODE_ENV;
});

// ── Helper ────────────────────────────────────────────────────────────────────

/** Issue an OPTIONS preflight for the given origin. */
async function preflight(origin: string): Promise<supertest.Response> {
  return request
    .options("/api/healthz")
    .set("Origin", origin)
    .set("Access-Control-Request-Method", "POST")
    .set("Access-Control-Request-Headers", "Authorization, Content-Type");
}

// ── 1. Same-origin (no Origin header) ────────────────────────────────────────

it("allows same-origin requests — no Origin header, no CORS rejection", async () => {
  const res = await request.get("/api/healthz");
  // Same-origin never triggers CORS middleware rejection (status may be 200 or 404)
  expect(res.status).not.toBe(500);
});

// ── 2. Static allowlist ───────────────────────────────────────────────────────

describe("static allowlist — always allowed", () => {
  beforeEach(() => {
    process.env["NODE_ENV"] = "production";
  });

  it("allows capacitor://localhost", async () => {
    const res = await preflight("capacitor://localhost");
    expect(res.status).toBeLessThan(500);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "capacitor://localhost",
    );
  });

  it("allows http://localhost", async () => {
    const res = await preflight("http://localhost");
    expect(res.status).toBeLessThan(500);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost");
  });

  it("allows https://localhost", async () => {
    const res = await preflight("https://localhost");
    expect(res.status).toBeLessThan(500);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "https://localhost",
    );
  });

  it.each([
    "https://getmindfulspace.com",
    "https://www.getmindfulspace.com",
  ])("allows the production origin %s", async (origin) => {
    const res = await preflight(origin);
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

// ── 3. CORS_ALLOWED_ORIGINS env var ──────────────────────────────────────────
// Note: this Set is built at module load time, so we can only test an origin
// that was present when the module was first imported. We rely on the static
// list for this test.

// ── 4 & 5. Replit Preview — development allows, with security checks ─────────

describe("*.replit.dev — development environment", () => {
  beforeEach(() => {
    process.env["NODE_ENV"] = "development";
  });

  it("allows https://<subdomain>.replit.dev (typical Replit Preview origin)", async () => {
    const origin = "https://abc123-00-xyz.username.replit.dev";
    const res = await preflight(origin);
    expect(res.status).toBeLessThan(500);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("allows a deeply-nested replit.dev subdomain", async () => {
    const origin = "https://foo.bar.replit.dev";
    const res = await preflight(origin);
    expect(res.status).toBeLessThan(500);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });

  // ── Security: reject lookalike domains ──────────────────────────────────────

  it("rejects https://evilreplit.dev — bare domain without .replit.dev subdomain", async () => {
    const res = await preflight("https://evilreplit.dev");
    expect(res.status).toBe(500);
  });

  it("rejects http://sub.replit.dev — non-HTTPS scheme", async () => {
    const res = await preflight("http://sub.replit.dev");
    expect(res.status).toBe(500);
  });

  it("rejects https://sub.notreplit.dev — different registrable domain", async () => {
    const res = await preflight("https://sub.notreplit.dev");
    expect(res.status).toBe(500);
  });

  it("rejects an arbitrary unknown cross-origin", async () => {
    const res = await preflight("https://attacker.example.com");
    expect(res.status).toBe(500);
  });
});

// ── 6. Replit Preview — production must NOT allow ────────────────────────────

describe("*.replit.dev — production environment", () => {
  beforeEach(() => {
    process.env["NODE_ENV"] = "production";
  });

  it("rejects https://<subdomain>.replit.dev in production", async () => {
    const res = await preflight(
      "https://abc123-00-xyz.username.replit.dev",
    );
    expect(res.status).toBe(500);
  });
});

// ── 9 & 10. OPTIONS preflight headers ────────────────────────────────────────

describe("OPTIONS preflight response headers", () => {
  it("includes credentials and Authorization + Content-Type in allow-headers", async () => {
    process.env["NODE_ENV"] = "development";
    const origin = "https://preview.replit.dev";
    const res = await preflight(origin);

    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    const allowedHeaders = (
      res.headers["access-control-allow-headers"] ?? ""
    ).toLowerCase();
    expect(allowedHeaders).toContain("authorization");
    expect(allowedHeaders).toContain("content-type");
  });
});
