import { NextResponse } from "next/server";

import { requireEligibleUser } from "@/lib/security/auth";
import { withCsrfProtect } from "@/lib/security/csrf";
import { authedJsonRoute } from "@/lib/security/route";
import {
  checkRateLimitForSession,
  createRateLimitResponse,
} from "@/lib/security/rate-limit";
import { BadRequestError } from "@/lib/security/errors";
import { profileUpdateSchema } from "@/lib/validations/matching";

function logProfileUpdateFailure(
  error: {
    code?: string | null;
    details?: string | null;
    hint?: string | null;
    message?: string | null;
  },
  userId: string,
) {
  console.error("[profile-update]", {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message ?? null,
    userIdSuffix: userId.slice(-8),
  });
}

export const POST = withCsrfProtect(
  authedJsonRoute(
    profileUpdateSchema,
    async (data, session, request) => {
      const rateLimit = await checkRateLimitForSession("general", session, request);
      if (!rateLimit.success) {
        return createRateLimitResponse(
          rateLimit,
          request,
          "Too many profile update attempts. Please wait and try again.",
        );
      }

      const { data: updatedProfile, error } = await session.supabase.rpc(
        "update_profile_basics",
        {
          p_display_name: data.display_name,
          p_department: data.department,
        },
      );

      if (error || !updatedProfile) {
        if (error) {
          logProfileUpdateFailure(error, session.user.id);

          const isInputError =
            error.code === "P0001" ||
            /display_name|department|required|invalid|too long|too short/i.test(
              error.message ?? "",
            );

          if (isInputError) {
            throw new BadRequestError("Please check your profile details and try again.");
          }
        }

        return NextResponse.json(
          { message: "We couldn't update your profile right now. Please try again in a moment." },
          { status: 500 },
        );
      }

      return {
        profile: updatedProfile,
      };
    },
    () => requireEligibleUser({ requireProfileComplete: true }),
  ),
);
