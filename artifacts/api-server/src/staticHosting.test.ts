import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import { createApp } from "./app";
import {
  isBlockedPublicPath,
  resolveAdjacentPublicDir,
} from "./frontendStatic";

vi.hoisted(() => {
  process.env.DATABASE_URL ??=
    "postgresql://zenflow:test@127.0.0.1:5432/zenflow_test";
});

const COPY_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../scripts/copy-hostinger-frontend.mjs",
);

function copyFrontendPublic(sourceDir: string, destDir: string): void {
  try {
    execFileSync(process.execPath, [COPY_SCRIPT, sourceDir, destDir], {
      stdio: "pipe",
    });
  } catch (error) {
    const err = error as { stderr?: Buffer; stdout?: Buffer; message: string };
    throw new Error(
      `${err.stderr?.toString() ?? ""}${err.stdout?.toString() ?? ""}${err.message}`,
    );
  }
}

const INDEX_HTML =
  "<!doctype html><html><head><title>Hostinger SPA</title></head><body><div id=\"root\">spa-shell</div></body></html>";

function makePublicDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "zen-flow-public-"));
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "index.html"), INDEX_HTML);
  writeFileSync(path.join(dir, "assets", "app.js"), "window.__ZEN_ASSET = true;");
  writeFileSync(path.join(dir, "secret.js.map"), "should-not-be-served");
  return dir;
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("API routes with production frontend mounted", () => {
  const publicDir = makePublicDir();
  const request = supertest(createApp({ publicDir }));

  afterAll(() => {
    rmSync(publicDir, { recursive: true, force: true });
  });

  it("returns JSON from /api/healthz", async () => {
    const res = await request.get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: "ok" });
    expect(String(res.text)).not.toContain("spa-shell");
  });

  it("keeps existing API routes as API responses", async () => {
    const res = await request.get("/api/tasks");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.status).not.toBe(200);
    expect(String(res.text)).not.toContain("<!doctype html>");
    expect(String(res.text)).not.toContain("spa-shell");
  });

  it("does not return the SPA for unknown /api routes", async () => {
    const res = await request.get("/api/this-route-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: "Not found" });
    expect(String(res.text)).not.toContain("spa-shell");
  });

  it("returns the frontend index.html for /", async () => {
    const res = await request.get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toContain("spa-shell");
    expect(res.text).toContain("<div id=\"root\">");
  });

  it("returns index.html for a client route such as /dashboard", async () => {
    const res = await request.get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toContain("spa-shell");
  });

  it("serves static assets from the public directory", async () => {
    const res = await request.get("/assets/app.js");
    expect(res.status).toBe(200);
    expect(res.text).toContain("window.__ZEN_ASSET = true;");
  });

  it("does not route POST requests to the SPA", async () => {
    const res = await request.post("/dashboard").send({ ping: true });
    expect(res.status).not.toBe(200);
    expect(String(res.text ?? "")).not.toContain("spa-shell");
  });

  it("does not serve source maps from public", async () => {
    const res = await request.get("/secret.js.map");
    expect(res.status).toBe(404);
    expect(String(res.text ?? "")).not.toContain("should-not-be-served");
  });
});

describe("development without a frontend build", () => {
  const request = supertest(createApp({ publicDir: null }));

  it("still serves the API when the frontend build is absent", async () => {
    const res = await request.get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("does not invent an SPA for browser routes", async () => {
    const res = await request.get("/");
    expect(res.status).toBe(404);
    expect(String(res.text ?? "")).not.toContain("spa-shell");
  });
});

describe("compiled ESM public path resolution", () => {
  it("resolves public/index.html next to the compiled entry file", () => {
    const distDir = mkdtempSync(path.join(tmpdir(), "zen-flow-dist-"));
    tempDirs.push(distDir);
    const publicDir = path.join(distDir, "public");
    mkdirSync(publicDir);
    writeFileSync(path.join(publicDir, "index.html"), INDEX_HTML);
    const entry = path.join(distDir, "index.mjs");
    writeFileSync(entry, "export {};");

    expect(resolveAdjacentPublicDir(pathToFileURL(entry).href)).toBe(publicDir);
  });

  it("does not depend on the process working directory", () => {
    const distDir = mkdtempSync(path.join(tmpdir(), "zen-flow-dist-"));
    tempDirs.push(distDir);
    const publicDir = path.join(distDir, "public");
    mkdirSync(publicDir);
    writeFileSync(path.join(publicDir, "index.html"), INDEX_HTML);
    const entry = path.join(distDir, "index.mjs");
    writeFileSync(entry, "export {};");

    const previousCwd = process.cwd();
    process.chdir(tmpdir());
    try {
      expect(resolveAdjacentPublicDir(pathToFileURL(entry).href)).toBe(publicDir);
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("returns null when the adjacent public directory is missing", () => {
    const distDir = mkdtempSync(path.join(tmpdir(), "zen-flow-dist-"));
    tempDirs.push(distDir);
    const entry = path.join(distDir, "index.mjs");
    writeFileSync(entry, "export {};");
    expect(resolveAdjacentPublicDir(pathToFileURL(entry).href)).toBeNull();
  });
});

describe("frontend copy script", () => {
  it("copies frontend files and omits .env and secret files", () => {
    const sourceDir = mkdtempSync(path.join(tmpdir(), "zen-flow-src-public-"));
    const apiDist = mkdtempSync(path.join(tmpdir(), "zen-flow-api-dist-"));
    tempDirs.push(sourceDir, apiDist);
    const destDir = path.join(apiDist, "public");

    mkdirSync(path.join(sourceDir, "assets"));
    writeFileSync(path.join(sourceDir, "index.html"), INDEX_HTML);
    writeFileSync(path.join(sourceDir, "assets", "app.js"), "ok");
    writeFileSync(path.join(sourceDir, ".env"), "SESSION_SECRET=do-not-copy");
    writeFileSync(path.join(sourceDir, ".env.local"), "AI_PROVIDER_API_KEY=do-not-copy");
    writeFileSync(path.join(sourceDir, "service.key"), "do-not-copy");

    copyFrontendPublic(sourceDir, destDir);

    expect(existsSync(path.join(destDir, "index.html"))).toBe(true);
    expect(readFileSync(path.join(destDir, "assets", "app.js"), "utf8")).toBe("ok");
    expect(existsSync(path.join(destDir, ".env"))).toBe(false);
    expect(existsSync(path.join(destDir, ".env.local"))).toBe(false);
    expect(existsSync(path.join(destDir, "service.key"))).toBe(false);
    expect(readdirSync(destDir).some((name) => name.startsWith(".env"))).toBe(
      false,
    );
  });

  it("fails clearly when the frontend build output is missing", () => {
    const apiDist = mkdtempSync(path.join(tmpdir(), "zen-flow-api-dist-"));
    tempDirs.push(apiDist);
    expect(() =>
      copyFrontendPublic(
        path.join(apiDist, "missing-frontend"),
        path.join(apiDist, "public"),
      ),
    ).toThrow(/Frontend build output is missing/);
  });

  it("never removes the whole API dist directory", () => {
    const sourceDir = mkdtempSync(path.join(tmpdir(), "zen-flow-src-public-"));
    const apiDist = mkdtempSync(path.join(tmpdir(), "zen-flow-api-dist-"));
    tempDirs.push(sourceDir, apiDist);
    writeFileSync(path.join(sourceDir, "index.html"), INDEX_HTML);
    writeFileSync(path.join(apiDist, "index.mjs"), "export {};");
    mkdirSync(path.join(apiDist, "public"), { recursive: true });
    writeFileSync(path.join(apiDist, "public", "old.html"), "old");

    copyFrontendPublic(sourceDir, path.join(apiDist, "public"));

    expect(existsSync(path.join(apiDist, "index.mjs"))).toBe(true);
    expect(existsSync(path.join(apiDist, "public", "index.html"))).toBe(true);
    expect(existsSync(path.join(apiDist, "public", "old.html"))).toBe(false);
  });
});

describe("blocked public paths", () => {
  it("blocks env files, source maps, and path traversal", () => {
    expect(isBlockedPublicPath("/.env")).toBe(true);
    expect(isBlockedPublicPath("/assets/app.js.map")).toBe(true);
    expect(isBlockedPublicPath("/../src/index.ts")).toBe(true);
    expect(isBlockedPublicPath("/assets/app.js")).toBe(false);
    expect(isBlockedPublicPath("/dashboard")).toBe(false);
  });
});
