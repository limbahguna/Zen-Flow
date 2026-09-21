export const CANONICAL_PRODUCTION_API_ORIGIN = "https://getmindfulspace.com";

export type ApiRuntimeContext = {
  rawEnv?: string | undefined;
  mode?: string;
  isDev?: boolean;
  isNative?: boolean;
};

export type ApiBuildContext = {
  command: "serve" | "build";
  mode: string;
  envValue?: string | undefined;
};

function trimEnv(raw: string | undefined): string {
  return (raw ?? "").trim();
}

export function normalizeApiOrigin(raw: string | undefined): string {
  const value = trimEnv(raw);
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "").replace(/\/api$/i, "");
  }
}

export function isLocalDevelopmentApiOrigin(origin: string): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

export function isCanonicalProductionApiOrigin(origin: string): boolean {
  return origin === CANONICAL_PRODUCTION_API_ORIGIN;
}

export function isUsableProductionApiOrigin(origin: string): boolean {
  if (!isCanonicalProductionApiOrigin(origin)) return false;
  try {
    return new URL(origin).protocol === "https:";
  } catch {
    return false;
  }
}

export function apiPath(path: string): string {
  const withQuery = path.trim();
  const [pathname, ...queryParts] = withQuery.split("?");
  const query = queryParts.length > 0 ? `?${queryParts.join("?")}` : "";
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const prefixed = withSlash === "/api" || withSlash.startsWith("/api/")
    ? withSlash
    : `/api${withSlash}`;
  return `${prefixed}${query}`;
}

export function joinApiOriginAndPath(origin: string, path: string): string {
  return `${normalizeApiOrigin(origin)}${apiPath(path)}`;
}

export function resolveApiOrigin(ctx: ApiRuntimeContext): string {
  const normalized = normalizeApiOrigin(ctx.rawEnv);
  const isDev = ctx.isDev ?? ctx.mode === "development";
  const isNative = Boolean(ctx.isNative);
  const androidProduction = ctx.mode === "android" || (isNative && !isDev);

  if (androidProduction) {
    return CANONICAL_PRODUCTION_API_ORIGIN;
  }

  if (!isDev && !isNative) {
    return isUsableProductionApiOrigin(normalized) ? normalized : "";
  }

  return normalized;
}

export function resolveApiUrl(path: string, ctx: ApiRuntimeContext): string {
  return joinApiOriginAndPath(resolveApiOrigin(ctx), path);
}

export function resolveBuildTimeApiBaseUrl(ctx: ApiBuildContext): string {
  const normalized = normalizeApiOrigin(ctx.envValue);

  if (ctx.command === "build" && ctx.mode === "android") {
    return CANONICAL_PRODUCTION_API_ORIGIN;
  }

  if (ctx.command === "build" && ctx.mode === "production") {
    return isUsableProductionApiOrigin(normalized) ? normalized : "";
  }

  return normalized;
}

export function assertHttpsApiOrigin(origin: string): void {
  if (!origin) {
    throw new Error("API origin is required.");
  }
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error("API origin is invalid.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Production API origin must use HTTPS.");
  }
}
