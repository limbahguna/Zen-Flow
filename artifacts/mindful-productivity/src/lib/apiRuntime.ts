import { Capacitor } from "@capacitor/core";
import { setBaseUrl } from "@workspace/api-client-react";
import {
  resolveApiOrigin,
  resolveApiUrl,
  type ApiRuntimeContext,
} from "./apiBaseUrl";

export function currentApiRuntime(): ApiRuntimeContext {
  return {
    rawEnv: import.meta.env.VITE_API_BASE_URL as string | undefined,
    mode: import.meta.env.MODE,
    isDev: import.meta.env.DEV,
    isNative: Capacitor.isNativePlatform(),
  };
}

export function appApiUrl(path: string, ctx: ApiRuntimeContext = currentApiRuntime()): string {
  return resolveApiUrl(path, ctx);
}

export function configureAppApiBase(ctx: ApiRuntimeContext = currentApiRuntime()): void {
  const origin = resolveApiOrigin(ctx);
  setBaseUrl(origin || null);
}
