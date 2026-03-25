type AuthFailureFlow = "login" | "signup" | "verify_email_resend";

const AUTH_USER_MESSAGES: Record<AuthFailureFlow, string> = {
  login: "Unable to sign in with those credentials.",
  signup: "Unable to create your account.",
  verify_email_resend: "Unable to resend verification email right now.",
};

export function getAuthSafeUserMessage(flow: AuthFailureFlow): string {
  return AUTH_USER_MESSAGES[flow];
}

export function logAuthFailure(
  flow: AuthFailureFlow,
  error: { message?: string | null; status?: number | null; code?: string | null },
  context?: { emailDomain?: string | null; detail?: string | null },
) {
  console.warn("[AUTH]", {
    flow,
    status: error.status ?? null,
    code: error.code ?? null,
    message: error.message ?? null,
    emailDomain: context?.emailDomain ?? null,
    detail: context?.detail ?? null,
    occurredAt: new Date().toISOString(),
  });
}
