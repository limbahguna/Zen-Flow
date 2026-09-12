import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_RESPONSE_LENGTH = 4_000;
const REPORT_LANGUAGES = ["en", "id", "ja"] as const;

type ReportLanguage = (typeof REPORT_LANGUAGES)[number];

interface ReportTokenPayload {
  v: number;
  uid: string;
  rid: string;
  response: string;
  language: ReportLanguage;
  exp: number;
}

export interface ReportableResponse {
  responseId: string;
  assistantResponse: string;
  language: ReportLanguage;
}

function tokenSecret(): string | null {
  return process.env.SESSION_SECRET || null;
}

function sign(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}

function isPayload(value: unknown): value is ReportTokenPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.v === TOKEN_VERSION &&
    typeof payload.uid === "string" &&
    typeof payload.rid === "string" &&
    typeof payload.response === "string" &&
    payload.response.trim().length > 0 &&
    payload.response.length <= MAX_RESPONSE_LENGTH &&
    typeof payload.language === "string" &&
    (REPORT_LANGUAGES as readonly string[]).includes(payload.language) &&
    typeof payload.exp === "number" &&
    Number.isFinite(payload.exp)
  );
}

export function createReportableResponseToken(
  userId: string,
  assistantResponse: string,
  language: string,
): string | null {
  const secret = tokenSecret();
  if (!secret) return null;
  const safeLanguage: ReportLanguage =
    language === "id" || language === "ja" ? language : "en";
  const payload: ReportTokenPayload = {
    v: TOKEN_VERSION,
    uid: userId,
    rid: randomUUID(),
    response: assistantResponse,
    language: safeLanguage,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret).toString("base64url")}`;
}

export function verifyReportableResponseToken(
  token: string,
  authenticatedUserId: string,
): ReportableResponse | null {
  const secret = tokenSecret();
  if (!secret || token.length > 12_000) return null;

  const [encodedPayload, encodedSignature, ...rest] = token.split(".");
  if (!encodedPayload || !encodedSignature || rest.length > 0) return null;

  let actualSignature: Buffer;
  let payload: unknown;
  try {
    actualSignature = Buffer.from(encodedSignature, "base64url");
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const expectedSignature = sign(encodedPayload, secret);
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature) ||
    !isPayload(payload) ||
    payload.uid !== authenticatedUserId ||
    payload.exp < Date.now()
  ) {
    return null;
  }

  return {
    responseId: payload.rid,
    assistantResponse: payload.response,
    language: payload.language,
  };
}