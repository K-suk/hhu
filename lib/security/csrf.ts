import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireAuth, requireEligibleUser } from "@/lib/security/auth";
import {
  CSRF_COOKIE_NAME,
  CSRF_FORM_FIELD_NAME,
  CSRF_HEADER_NAME,
  CSRF_TOKEN_TTL_MS,
} from "@/lib/security/csrf-shared";
import {
  AuthenticationError,
  BadRequestError,
  ForbiddenError,
} from "@/lib/security/errors";

type CsrfPayload = {
  nonce: string;
  timestamp: number;
  userId: string;
};

function getCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET;

  if (!secret) {
    throw new Error("Missing CSRF_SECRET.");
  }

  return secret;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    if (encodeBase64Url(decoded) !== value) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getCsrfSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function parsePayload(decodedPayload: string): CsrfPayload | null {
  const [userId, timestampText, nonce] = decodedPayload.split(":");
  const timestamp = Number(timestampText);

  if (!userId || !nonce || !Number.isFinite(timestamp)) {
    return null;
  }

  return {
    userId,
    timestamp,
    nonce,
  };
}

export function generateCsrfToken(userId: string, now = Date.now()): string {
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${userId}:${now}:${nonce}`;
  const encodedPayload = encodeBase64Url(payload);
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function validateCsrfToken(
  token: string,
  expectedUserId: string,
  now = Date.now(),
): { valid: true; payload: CsrfPayload } | { valid: false; reason: string } {
  const [encodedPayload, providedSignature, ...extraParts] = token.split(".");

  if (!encodedPayload || !providedSignature || extraParts.length > 0) {
    return { valid: false, reason: "malformed_token" };
  }

  const decodedPayload = decodeBase64Url(encodedPayload);
  if (!decodedPayload) {
    return { valid: false, reason: "invalid_base64" };
  }

  const parsedPayload = parsePayload(decodedPayload);
  if (!parsedPayload) {
    return { valid: false, reason: "invalid_payload" };
  }

  if (parsedPayload.userId !== expectedUserId) {
    return { valid: false, reason: "user_mismatch" };
  }

  if (now - parsedPayload.timestamp > CSRF_TOKEN_TTL_MS) {
    return { valid: false, reason: "expired" };
  }

  if (parsedPayload.timestamp > now + 60_000) {
    return { valid: false, reason: "issued_in_future" };
  }

  const expectedSignature = signPayload(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return { valid: false, reason: "invalid_signature" };
  }

  return {
    valid: true,
    payload: parsedPayload,
  };
}

export function extractCsrfHeaderToken(request: Request): string | null {
  const token = request.headers.get(CSRF_HEADER_NAME);
  return token?.trim() || null;
}

export async function extractCsrfCookieToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value?.trim() || null;
}

export async function issueCsrfTokenForCurrentUser() {
  const session = await requireEligibleUser();
  const existingToken = await extractCsrfCookieToken();
  const validation = existingToken
    ? validateCsrfToken(existingToken, session.user.id)
    : null;
  const token =
    validation?.valid === true
      ? existingToken
      : generateCsrfToken(session.user.id);

  const response = NextResponse.json(
    {
      token,
      expiresInMs: CSRF_TOKEN_TTL_MS,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  if (!token) {
    throw new Error("Failed to create CSRF token.");
  }

  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CSRF_TOKEN_TTL_MS / 1000,
  });

  return response;
}

function assertMatchingDoubleSubmitTokens(
  submittedToken: string | null,
  cookieToken: string | null,
): string {
  if (!submittedToken || !cookieToken) {
    throw new ForbiddenError("Missing CSRF token.");
  }

  if (submittedToken !== cookieToken) {
    throw new ForbiddenError("Invalid CSRF token.");
  }

  return submittedToken;
}

export async function verifyCsrfRequest(request: Request, expectedUserId: string) {
  const headerToken = extractCsrfHeaderToken(request);
  const cookieToken = await extractCsrfCookieToken();

  const verifiedToken = assertMatchingDoubleSubmitTokens(headerToken, cookieToken);

  const validation = validateCsrfToken(verifiedToken, expectedUserId);
  if (!validation.valid) {
    throw new ForbiddenError("Invalid CSRF token.");
  }

  return validation.payload;
}

export async function verifyCsrfFormSubmission(
  formData: FormData,
  expectedUserId: string,
) {
  const tokenValue = formData.get(CSRF_FORM_FIELD_NAME);
  const submittedToken = typeof tokenValue === "string" ? tokenValue.trim() : null;
  const cookieToken = await extractCsrfCookieToken();

  const verifiedToken = assertMatchingDoubleSubmitTokens(submittedToken, cookieToken);

  const validation = validateCsrfToken(verifiedToken, expectedUserId);
  if (!validation.valid) {
    throw new ForbiddenError("Invalid CSRF token.");
  }

  return validation.payload;
}

export function withCsrfProtect<THandler extends (request: Request) => Promise<Response>>(
  handler: THandler,
) {
  return async function csrfProtectedRoute(request: Request): Promise<Response> {
    try {
      const session = await requireAuth();
      await verifyCsrfRequest(request, session.user.id);
      return await handler(request);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      if (error instanceof ForbiddenError) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      if (error instanceof BadRequestError) {
        return NextResponse.json(
          {
            message: error.message,
            errors: error.fieldErrors,
          },
          { status: 400 },
        );
      }

      console.error(error);
      return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
  };
}

// Timestamp + nonce make tokens hard to forge and time-bounded, but not single-use.
// To block replay inside the 1-hour window, persist used nonces server-side and reject reuse.
