import { NextResponse } from "next/server";

import {
  assertMatchStatus,
  assertRatedUserIsPartner,
  getExistingUserRatingForMatch,
  requireMatchParticipant,
} from "@/lib/security/authz";
import { requireEligibleUser } from "@/lib/security/auth";
import { withCsrfProtect } from "@/lib/security/csrf";
import { authedJsonRoute } from "@/lib/security/route";
import {
  checkRateLimitForSession,
  createRateLimitResponse,
} from "@/lib/security/rate-limit";
import { submitGradeSchema } from "@/lib/validations/matching";

export const POST = withCsrfProtect(
  authedJsonRoute(
    submitGradeSchema,
    async (data, session, request) => {
      const rateLimit = await checkRateLimitForSession("general", session, request);
      if (!rateLimit.success) {
        return createRateLimitResponse(
          rateLimit,
          request,
          "Too many grading attempts. Please wait and try again.",
        );
      }

      const authorizedMatch = await requireMatchParticipant(
        session,
        data.p_match_id,
      );
      assertMatchStatus(
        session,
        authorizedMatch.match,
        ["active", "finished", "graded"],
        "rating_access_denied",
      );
      assertRatedUserIsPartner(
        session,
        data.p_match_id,
        data.p_rated_user_id,
        authorizedMatch.partnerUserId,
      );

      const existingGrade = await getExistingUserRatingForMatch(
        session,
        data.p_match_id,
      );
      if (existingGrade) {
        return NextResponse.json(
          { message: "Grade already submitted." },
          { status: 409 },
        );
      }

      const { error } = await session.supabase.rpc("submit_grade", {
        p_match_id: data.p_match_id,
        p_rated_user_id: data.p_rated_user_id,
        p_grade_point: data.p_grade_point,
      });

      if (error) {
        return NextResponse.json(
          { message: "Failed to submit grade." },
          { status: 500 },
        );
      }

      return {
        success: true,
      };
    },
    () => requireEligibleUser({ requireProfileComplete: true }),
  ),
);
