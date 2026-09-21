import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKIP_NAMES = new Set([
  ".env",
  ".git",
  ".gitignore",
  ".gitattributes",
  "node_modules",
]);

export function shouldSkipCopiedName(name) {
  const base = name.toLowerCase();
  if (SKIP_NAMES.has(base) || SKIP_NAMES.has(name)) return true;
  if (base.startsWith(".env.")) return true;
  if (base.endsWith(".pem") || base.endsWith(".key") || base.endsWith(".p12")) {
    return true;
  }
  if (base.endsWith(".jks") || base.endsWith(".keystore")) return true;
  return false;
}

export function copyFrontendPublic(sourceDir, destDir) {
  const sourceIndex = path.join(sourceDir, "index.html");
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(
      `Frontend build output is missing: ${sourceDir}. Build @workspace/mindful-productivity first.`,
    );
  }
  if (!fs.existsSync(sourceIndex)) {
    throw new Error(
      `Frontend build output is missing index.html: ${sourceIndex}. Build @workspace/mindful-productivity first.`,
    );
  }

  const apiDist = path.dirname(destDir);
  if (!fs.existsSync(apiDist) || !fs.statSync(apiDist).isDirectory()) {
    throw new Error(
      `API dist directory is missing: ${apiDist}. Build @workspace/api-server first.`,
    );
  }

  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  fs.cpSync(sourceDir, destDir, {
    recursive: true,
    filter(srcPath) {
      return !shouldSkipCopiedName(path.basename(srcPath));
    },
  });
}

function defaultPaths() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  return {
    sourceDir: path.join(
      repoRoot,
      "artifacts",
      "mindful-productivity",
      "dist",
      "public",
    ),
    destDir: path.join(repoRoot, "artifacts", "api-server", "dist", "public"),
  };
}

function isExecutedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return (
    path.normalize(fileURLToPath(import.meta.url)) ===
    path.normalize(path.resolve(entry))
  );
}

if (isExecutedDirectly()) {
  const defaults = defaultPaths();
  const sourceDir = process.argv[2] ?? defaults.sourceDir;
  const destDir = process.argv[3] ?? defaults.destDir;
  copyFrontendPublic(sourceDir, destDir);
  console.log(`Copied frontend files to ${destDir}`);
}
