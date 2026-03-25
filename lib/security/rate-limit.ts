import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { waitUntil } from "@vercel/functions";

import type { AuthSession } from "@/lib/security/auth";

export type RateLimitPolicy = "auth" | "matching" | "general";

type RateLimitConfig = {
  max: number;
  prefix: string;
  window: `${number} ${"s" | "m" | "h" | "d"}`;
};

type RateLimitIdentifierInput = {
  ip?: string | null;
  policy: RateLimitPolicy;
  userId?: string | null;
};

export type RateLimitResult = {
  identifier: string;
  limit: number;
  pending: Promise<unknown>;
  policy: RateLimitPolicy;
  remaining: number;
  reset: number;
  retryAfter: number;
  success: boolean;
};

const RATE_LIMIT_CONFIG: Record<RateLimitPolicy, RateLimitConfig> = {
  auth: {
    max: 5,
    prefix: "hhu:rl:auth",
    window: "15 m",
  },
  matching: {
    max: 10,
    prefix: "hhu:rl:matching",
    window: "1 m",
  },
  general: {
    max: 100,
    prefix: "hhu:rl:general",
    window: "1 m",
  },
};

const hasUpstashEnv =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = hasUpstashEnv ? Redis.fromEnv() : null;

const ratelimits = redis
  ? {
      auth: new Ratelimit({
        analytics: true,
        ephemeralCache: false,
        limiter: Ratelimit.slidingWindow(
          RATE_LIMIT_CONFIG.auth.max,
          RATE_LIMIT_CONFIG.auth.window,
        ),
        prefix: RATE_LIMIT_CONFIG.auth.prefix,
        redis,
      }),
      matching: new Ratelimit({
        analytics: true,
        ephemeralCache: false,
        limiter: Ratelimit.slidingWindow(
          RATE_LIMIT_CONFIG.matching.max,
          RATE_LIMIT_CONFIG.matching.window,
        ),
        prefix: RATE_LIMIT_CONFIG.matching.prefix,
        redis,
      }),
      general: new Ratelimit({
        analytics: true,
        ephemeralCache: false,
        limiter: Ratelimit.slidingWindow(
          RATE_LIMIT_CONFIG.general.max,
          RATE_LIMIT_CONFIG.general.window,
        ),
        prefix: RATE_LIMIT_CONFIG.general.prefix,
        redis,
      }),
    }
  : null;

function getFallbackIp(): string {
  return "0.0.0.0";
}

function parseForwardedFor(value: string | null): string | null {
  if (!value) return null;

  const first = value.split(",")[0]?.trim();
  return first || null;
}

function parseForwardedHeader(value: string | null): string | null {
  if (!value) return null;

  const parts = value.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith("for=")) {
      continue;
    }

    return trimmed.replace(/^for=/, "").replace(/^"|"$/g, "").trim() || null;
  }

  return null;
}

export function getClientIp(request: Request | NextRequest): string {
  const headerIp =
    parseForwardedFor(request.headers.get("x-forwarded-for")) ??
    request.headers.get("x-real-ip")?.trim() ??
    request.headers.get("cf-connecting-ip")?.trim() ??
    parseForwardedHeader(request.headers.get("forwarded"));

  if (headerIp) {
    return headerIp;
  }

  if ("ip" in request && typeof request.ip === "string" && request.ip) {
    return request.ip;
  }

  return getFallbackIp();
}

export async function getClientIpForServerAction(): Promise<string> {
  const headerStore = await headers();

  return (
    parseForwardedFor(headerStore.get("x-forwarded-for")) ??
    headerStore.get("x-real-ip")?.trim() ??
    headerStore.get("cf-connecting-ip")?.trim() ??
    parseForwardedHeader(headerStore.get("forwarded")) ??
    getFallbackIp()
  );
}

export function getRateLimitIdentifier({
  ip,
  policy,
  userId,
}: RateLimitIdentifierInput): string {
  const scope = userId ? `user:${userId}` : `ip:${ip ?? getFallbackIp()}`;
  return `${policy}:${scope}`;
}

function logRateLimitTrigger(result: RateLimitResult) {
  console.warn("[SECURITY][RATE_LIMIT]", {
    identifier: result.identifier,
    limit: result.limit,
    policy: result.policy,
    remaining: result.remaining,
    reset: new Date(result.reset).toISOString(),
    retryAfter: result.retryAfter,
  });
}

function getRetryAfterSeconds(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

async function runRateLimitCheck(
  policy: RateLimitPolicy,
  identifier: string,
): Promise<RateLimitResult> {
  if (!ratelimits) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Upstash Redis env vars are required in production.");
    }

    return {
      identifier,
      limit: Number.MAX_SAFE_INTEGER,
      pending: Promise.resolve(),
      policy,
      remaining: Number.MAX_SAFE_INTEGER,
      reset: Date.now(),
      retryAfter: 0,
      success: true,
    };
  }

  const result = await ratelimits[policy].limit(identifier);
  const rateLimitResult: RateLimitResult = {
    identifier,
    limit: result.limit,
    pending: result.pending,
    policy,
    remaining: result.remaining,
    reset: result.reset,
    retryAfter: getRetryAfterSeconds(result.reset),
    success: result.success,
  };

  waitUntil(result.pending);

  if (!result.success) {
    logRateLimitTrigger(rateLimitResult);
  }

  return rateLimitResult;
}

export async function checkRateLimit(input: {
  ip?: string | null;
  policy: RateLimitPolicy;
  userId?: string | null;
}): Promise<RateLimitResult> {
  const identifier = getRateLimitIdentifier(input);
  return runRateLimitCheck(input.policy, identifier);
}

export async function checkRateLimitForSession(
  policy: RateLimitPolicy,
  session: AuthSession,
  request?: Request | NextRequest,
): Promise<RateLimitResult> {
  return checkRateLimit({
    ip: request ? getClientIp(request) : undefined,
    policy,
    userId: session.user.id,
  });
}

export async function checkRateLimitForServerAction(
  policy: RateLimitPolicy,
  userId?: string | null,
): Promise<RateLimitResult> {
  return checkRateLimit({
    ip: userId ? undefined : await getClientIpForServerAction(),
    policy,
    userId,
  });
}

export function applyRateLimitHeaders(
  response: Response | NextResponse,
  result: RateLimitResult,
): Response | NextResponse {
  response.headers.set("X-RateLimit-Limit", result.limit.toString());
  response.headers.set("X-RateLimit-Policy", result.policy);
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  response.headers.set("X-RateLimit-Reset", result.reset.toString());

  return response;
}

export function createRateLimitResponse(
  result: RateLimitResult,
  request: Request | NextRequest,
  message = "Too Many Requests",
): NextResponse {
  const isApiRequest =
    "nextUrl" in request
      ? request.nextUrl.pathname.startsWith("/api")
      : new URL(request.url).pathname.startsWith("/api");

  const response = isApiRequest
    ? NextResponse.json(
        {
          message,
          retryAfter: result.retryAfter,
        },
        { status: 429 },
      )
    : new NextResponse(message, { status: 429 });

  response.headers.set("Retry-After", result.retryAfter.toString());

  return applyRateLimitHeaders(response, result) as NextResponse;
}
