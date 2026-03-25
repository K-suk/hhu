import { NextResponse } from "next/server";
import { z } from "zod";

import { requireEligibleUser } from "@/lib/security/auth";
import {
  assertMatchStatus,
  assertProfileGenderIdentity,
  assertRequestedDomain,
  requireMatchParticipant,
} from "@/lib/security/authz";
import { withCsrfProtect } from "@/lib/security/csrf";
import { AuthenticationError, ForbiddenError } from "@/lib/security/errors";
import {
  applyRateLimitHeaders,
  checkRateLimitForSession,
  createRateLimitResponse,
} from "@/lib/security/rate-limit";
import { authedJsonRoute } from "@/lib/security/route";
import {
  enrolCourseSchema,
  reportMatchSchema,
} from "@/lib/validations/matching";

const matchingRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("enrol"),
    payload: enrolCourseSchema,
  }),
  z.object({
    action: z.literal("report"),
    payload: reportMatchSchema,
  }),
]);

export const POST = withCsrfProtect(
  authedJsonRoute(
    matchingRequestSchema,
    async (data, session, request) => {
      let matchingRateLimit = null;

      if (data.action === "enrol") {
        await requireEligibleUser({
          requireProfileComplete: true,
          requireUniversityUnlocked: true,
        });
        matchingRateLimit = await checkRateLimitForSession(
          "matching",
          session,
          request,
        );

        if (!matchingRateLimit.success) {
          return createRateLimitResponse(
            matchingRateLimit,
            request,
            "Too many queue attempts. Please wait before trying again.",
          );
        }
      }

      if (data.action === "report") {
        const reportRateLimit = await checkRateLimitForSession(
          "general",
          session,
          request,
        );
        if (!reportRateLimit.success) {
          return createRateLimitResponse(
            reportRateLimit,
            request,
            "Too many report attempts. Please wait before trying again.",
          );
        }

        const authorizedMatch = await requireMatchParticipant(
          session,
          data.payload.match_id,
        );
        assertMatchStatus(
          session,
          authorizedMatch.match,
          ["active", "finished", "graded"],
          "report_access_denied",
        );

        const reportEndpoint =
          process.env.NEXT_PUBLIC_FORMSPREE_REPORT_ENDPOINT ??
          "https://formspree.io/f/xeelzwnj";

        const reportResponse = await fetch(reportEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            category: data.payload.category,
            details: data.payload.details,
            match_id: authorizedMatch.match.id,
            reporter_id: session.user.id,
            reported_user_id: authorizedMatch.partnerUserId,
          }),
        });

        if (!reportResponse.ok) {
          return NextResponse.json(
            { message: "Report submission failed. Please contact support." },
            { status: 502 },
          );
        }

        const { error } = await session.supabase.rpc("report_match", {
          p_match_id: authorizedMatch.match.id,
        });

        if (error) {
          return NextResponse.json(
            { message: "Failed to report match." },
            { status: 500 },
          );
        }

        return {
          success: true,
        };
      }

      assertRequestedDomain(session, data.payload.p_email_domain);
      assertProfileGenderIdentity(session, data.payload.p_gender_identity);

      const { data: result, error } = await session.supabase.rpc(
        "enrol_course",
        {
          p_course_id: data.payload.p_course_id,
          p_gender_identity: data.payload.p_gender_identity,
          p_email_domain: data.payload.p_email_domain,
        },
      );

      if (error) {
        return NextResponse.json(
          { message: "Failed to enroll in course." },
          { status: 500 },
        );
      }

      const response = NextResponse.json({
        matchId:
          Array.isArray(result) && result.length > 0
            ? (result[0]?.match_id ?? null)
            : null,
      });

      return matchingRateLimit
        ? applyRateLimitHeaders(response, matchingRateLimit)
        : response;
    },
    () => requireEligibleUser({ requireProfileComplete: true }),
  ),
);

export const DELETE = withCsrfProtect(async function deleteMatchingRoute() {
  try {
    const session = await requireEligibleUser({ requireProfileComplete: true });

    const { error } = await session.supabase
      .from("queues")
      .delete()
      .eq("user_id", session.user.id);

    if (error) {
      return NextResponse.json(
        { message: "Failed to cancel search." },
        { status: 500 },
      );
    }

    await session.supabase.rpc("set_profile_idle");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
});
