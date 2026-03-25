"use server";

import { redirect } from "next/navigation";

import { requireEligibleUser } from "@/lib/security/auth";
import { verifyCsrfFormSubmission } from "@/lib/security/csrf";
import { checkRateLimitForServerAction } from "@/lib/security/rate-limit";
import {
  setupProfileSchema,
  type SetupProfileActionState,
} from "@/lib/validations/matching";

export async function completeSetupAction(
  _prevState: SetupProfileActionState,
  formData: FormData,
): Promise<SetupProfileActionState> {
  let session: Awaited<ReturnType<typeof requireEligibleUser>>;

  try {
    session = await requireEligibleUser();
    await verifyCsrfFormSubmission(formData, session.user.id);
  } catch {
    return {
      status: "error",
      message: "Your session could not be verified. Refresh and try again.",
    };
  }

  const rateLimit = await checkRateLimitForServerAction("general", session.user.id);
  if (!rateLimit.success) {
    return {
      status: "error",
      message: `Too many setup attempts. Try again in ${rateLimit.retryAfter}s.`,
    };
  }

  const parsed = setupProfileSchema.safeParse({
    display_name: formData.get("display_name"),
    department: formData.get("department"),
    gender_identity: formData.get("gender_identity"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { data, error } = await session.supabase.rpc("complete_profile_setup", {
    p_display_name: parsed.data.display_name,
    p_department: parsed.data.department,
    p_gender_identity: parsed.data.gender_identity,
  });

  if (error || !data) {
    return {
      status: "error",
      message:
        error?.message ??
        "We couldn't update your profile. Please try again in a moment.",
    };
  }

  redirect("/");
}
