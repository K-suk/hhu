"use server";

import { redirect } from "next/navigation";

import { getAuthSafeUserMessage, logAuthFailure } from "@/lib/security/auth-feedback";
import { checkRateLimitForServerAction } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/lib/validations/auth";
import {
  extractEmailDomain,
  getMinimumAgeOrDefault,
  loginSchema,
  signUpSchema,
  validateBirthDateForMinimumAge,
} from "@/lib/validations/auth";

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const rateLimit = await checkRateLimitForServerAction("auth");

  if (!rateLimit.success) {
    return {
      status: "error",
      message: `Too many sign-up attempts. Try again in ${rateLimit.retryAfter}s.`,
    };
  }

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    birth_date: formData.get("birth_date"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const emailDomain = extractEmailDomain(parsed.data.email);

  if (!emailDomain) {
    return {
      status: "error",
      message: "Please use an authorized university email address.",
    };
  }

  const { data: minAgeRows, error: minAgeError } = await supabase.rpc(
    "get_domain_min_age",
    {
      p_email_domain: emailDomain,
    },
  );

  if (minAgeError) {
    return {
      status: "error",
      message: "Failed to verify your university age policy. Please try again.",
    };
  }

  const domainRow = minAgeRows?.[0];

  if (!domainRow?.is_known) {
    return {
      status: "error",
      message:
        "Your university is not yet supported. Please request to add it via the sign-up page.",
      fieldErrors: {
        email: ["This email domain is not in our university whitelist."],
      },
    };
  }

  const requiredMinAge = getMinimumAgeOrDefault(domainRow.min_age);
  const birthDateErrors = validateBirthDateForMinimumAge(
    parsed.data.birth_date,
    requiredMinAge,
  );

  if (birthDateErrors) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: {
        birth_date: birthDateErrors,
      },
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        email_domain: emailDomain,
        birth_date: parsed.data.birth_date,
        required_min_age: requiredMinAge,
      },
    },
  });

  if (error) {
    logAuthFailure(
      "signup",
      error,
      { emailDomain, detail: "supabase_auth_signup_failed" },
    );

    return {
      status: "error",
      message: getAuthSafeUserMessage("signup"),
    };
  }

  if (data.session) {
    redirect("/setup");
  }

  return {
    status: "success",
    message: "Check your inbox to confirm your account before logging in.",
  };
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const rateLimit = await checkRateLimitForServerAction("auth");

  if (!rateLimit.success) {
    return {
      status: "error",
      message: `Too many sign-in attempts. Try again in ${rateLimit.retryAfter}s.`,
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logAuthFailure(
      "login",
      error,
      {
        emailDomain: extractEmailDomain(parsed.data.email),
        detail: "supabase_auth_signin_failed",
      },
    );

    return {
      status: "error",
      message: getAuthSafeUserMessage("login"),
    };
  }

  redirect("/");
}
