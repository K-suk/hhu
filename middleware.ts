import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyRateLimitHeaders,
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
} from "@/lib/security/rate-limit";
import type { Database } from "@/lib/supabase/database.types";

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return { supabaseUrl, supabaseAnonKey };
}

const PUBLIC_PATHS = ["/login", "/privacy", "/terms"];
const PUBLIC_API_PATHS = ["/api/university-age"];
const SETUP_ALLOWED_PATHS = ["/setup", "/api/csrf"];
const SUSPENDED_PATH = "/suspended";

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_API_PATHS.includes(pathname);
}

function isSetupAllowedPath(pathname: string) {
  return SETUP_ALLOWED_PATHS.includes(pathname);
}

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function extractEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    return null;
  }

  const [, domain] = normalized.split("@");
  return domain || null;
}

async function getProfileGateState(
  supabase: SupabaseClient<Database>,
  userId: string,
  userEmail: string | undefined,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, department, gender_identity, email_domain, is_suspended")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      profileComplete: false,
      isSuspended: false,
      emailDomain: extractEmailDomain(userEmail ?? ""),
    };
  }

  const profileComplete = Boolean(
    data.display_name && data.department && data.gender_identity,
  );

  return {
    profileComplete,
    isSuspended: data.is_suspended === true,
    emailDomain: data.email_domain ?? extractEmailDomain(userEmail ?? ""),
  };
}

export async function middleware(request: NextRequest, _event: NextFetchEvent) {
  let response = NextResponse.next({
    request,
  });

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublic = isPublicPath(pathname);
  const isApiRequest = isApiPath(pathname);

  const globalRateLimit = await checkRateLimit({
    ip: getClientIp(request),
    policy: "general",
    userId: user?.id ?? null,
  });

  if (!globalRateLimit.success) {
    return createRateLimitResponse(
      globalRateLimit,
      request,
      "Too Many Requests",
    );
  }

  response = applyRateLimitHeaders(response, globalRateLimit) as NextResponse;

  if (!user && !isPublic) {
    if (isApiRequest) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    if (!user.email_confirmed_at) {
      if (pathname !== "/verify-email" && !isPublic) {
        if (isApiRequest) {
          return NextResponse.json(
            { message: "Email verification required." },
            { status: 403 },
          );
        }

        const verifyEmailUrl = request.nextUrl.clone();
        verifyEmailUrl.pathname = "/verify-email";
        return NextResponse.redirect(verifyEmailUrl);
      }

      return response;
    }

    const gateState = await getProfileGateState(
      supabase,
      user.id,
      user.email,
    );

    if (gateState.isSuspended && pathname !== SUSPENDED_PATH && !isPublic) {
      if (isApiRequest) {
        return NextResponse.json(
          { message: "Your account has been suspended." },
          { status: 403 },
        );
      }

      const suspendedUrl = request.nextUrl.clone();
      suspendedUrl.pathname = SUSPENDED_PATH;
      return NextResponse.redirect(suspendedUrl);
    }

    if (!gateState.isSuspended && pathname === SUSPENDED_PATH) {
      const appUrl = request.nextUrl.clone();
      appUrl.pathname = "/";
      return NextResponse.redirect(appUrl);
    }

    if (pathname === "/login" || pathname === "/verify-email") {
      const appUrl = request.nextUrl.clone();
      appUrl.pathname = gateState.profileComplete ? "/" : "/setup";
      return NextResponse.redirect(appUrl);
    }

    if (!gateState.profileComplete && !isSetupAllowedPath(pathname) && !isPublic) {
      if (isApiRequest) {
        return NextResponse.json(
          { message: "Complete your profile to continue." },
          { status: 403 },
        );
      }

      const setupUrl = request.nextUrl.clone();
      setupUrl.pathname = "/setup";
      return NextResponse.redirect(setupUrl);
    }

    if (gateState.profileComplete && gateState.emailDomain) {
      const { data: university } = await supabase
        .from("university")
        .select("is_unlocked")
        .eq("email_domain", gateState.emailDomain)
        .maybeSingle();

      const isUnlocked = university?.is_unlocked ?? false;

      if (!isUnlocked && pathname !== "/waitlist" && !isPublic) {
        if (isApiRequest) {
          return NextResponse.json(
            { message: "Your university is not unlocked yet." },
            { status: 403 },
          );
        }

        const waitlistUrl = request.nextUrl.clone();
        waitlistUrl.pathname = "/waitlist";
        return NextResponse.redirect(waitlistUrl);
      }

      if (isUnlocked && pathname === "/waitlist") {
        const appUrl = request.nextUrl.clone();
        appUrl.pathname = "/";
        return NextResponse.redirect(appUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
