import { createClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Locals {
      authenticatedUser?: {
        id: string;
      };
    }
  }
}

function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;

  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match?.[1] ?? null;
}

/**
 * Verifies a Supabase access token and stores only the verified user ID on the
 * request response context. Authentication data is intentionally never logged.
 */
export async function requireSupabaseAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.headers.authorization;
  if (!authorization) {
    res.status(401).json({ error: "Missing authentication token" });
    return;
  }

  const token = readBearerToken(authorization);
  if (!token) {
    res.status(401).json({ error: "Invalid authentication token" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: "Server authentication not configured" });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user?.id) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    res.locals.authenticatedUser = { id: data.user.id };
    next();
  } catch {
    res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Authentication middleware must run before a route reads this value.
 * Keeping this lookup in one helper makes the request context type-safe.
 */
export function getAuthenticatedUserId(res: Response): string {
  const userId = res.locals.authenticatedUser?.id;
  if (!userId) {
    throw new Error("Authenticated route is missing an authentication context.");
  }
  return userId;
}