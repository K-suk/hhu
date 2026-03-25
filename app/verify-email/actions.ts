"use server";

import type { AuthActionState } from "@/lib/validations/auth";
import { checkRateLimitForServerAction } from "@/lib/security/rate-limit";
import { getAuthSafeUserMessage, logAuthFailure } from "@/lib/security/auth-feedback";
import { createClient } from "@/lib/supabase/server";
import { extractEmailDomain } from "@/lib/validations/auth";

export async function resendVerificationEmailAction(
  _prevState: AuthActionState,
  _formData: FormData,
): Promise<AuthActionState> {
  const rateLimit = await checkRateLimitForServerAction("auth");

  if (!rateLimit.success) {
    return {
      status: "error",
      message: `Too many verification attempts. Try again in ${rateLimit.retryAfter}s.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    logAuthFailure(
      "verify_email_resend",
      { message: "Missing authenticated user email." },
      { detail: "missing_session_email" },
    );

    return {
      status: "error",
      message: getAuthSafeUserMessage("verify_email_resend"),
    };
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
  });

  if (error) {
    logAuthFailure(
      "verify_email_resend",
      error,
      { emailDomain: extractEmailDomain(user.email), detail: "supabase_auth_resend_failed" },
    );

    return {
      status: "error",
      message: getAuthSafeUserMessage("verify_email_resend"),
    };
  }

  return {
    status: "success",
    message: "Verification email sent. Check your inbox and spam folder.",
  };
}
