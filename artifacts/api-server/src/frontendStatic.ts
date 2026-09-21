import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Express, NextFunction, Request, Response } from "express";
import express from "express";

export function resolveAdjacentPublicDir(moduleUrl: string): string | null {
  const dir = path.dirname(fileURLToPath(moduleUrl));
  const publicDir = path.resolve(dir, "public");
  const indexHtml = path.join(publicDir, "index.html");
  try {
    if (fs.existsSync(indexHtml) && fs.statSync(publicDir).isDirectory()) {
      return publicDir;
    }
  } catch {
    return null;
  }
  return null;
}

export function isBlockedPublicPath(urlPath: string): boolean {
  let decoded = urlPath;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return true;
  }
  const normalized = decoded.replace(/\\/g, "/");
  if (normalized.includes("..")) return true;
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) return true;
  const base = segments.at(-1) ?? "";
  if (base.endsWith(".map")) return true;
  if (base.toLowerCase().startsWith(".env")) return true;
  return false;
}

function isApiPath(urlPath: string): boolean {
  return urlPath === "/api" || urlPath.startsWith("/api/");
}

export function mountFrontend(app: Express, publicDir: string): void {
  const indexHtml = path.join(publicDir, "index.html");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isApiPath(req.path)) {
      next();
      return;
    }
    if (isBlockedPublicPath(req.path)) {
      res.status(404).end();
      return;
    }
    next();
  });

  app.use(
    express.static(publicDir, {
      index: false,
      fallthrough: true,
      redirect: false,
      dotfiles: "ignore",
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (isApiPath(req.path)) {
      next();
      return;
    }
    if (isBlockedPublicPath(req.path)) {
      res.status(404).end();
      return;
    }
    res.sendFile(indexHtml, (err) => {
      if (err) next(err);
    });
  });
}
