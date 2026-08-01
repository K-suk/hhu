import { z } from "zod";

import { handleProtectedResponse } from "@/lib/client/security-ui";
import { getCsrfToken } from "@/lib/security/csrf-client";
import { CSRF_HEADER_NAME } from "@/lib/security/csrf-shared";
import { enrolCourseSchema } from "@/lib/validations/matching";

const enrolResponseSchema = z.object({
  matchId: z.string().nullable().optional(),
});

const cancelResponseSchema = z.object({
  success: z.literal(true),
});

type EnrolInput = z.infer<typeof enrolCourseSchema>;

export type MatchingRequestResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export async function enrolInCourseRequest(input: {
  payload: EnrolInput;
  onUnauthorized: () => void;
}): Promise<MatchingRequestResult<{ matchId: string | null }>> {
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/matching", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CSRF_HEADER_NAME]: csrfToken,
    },
    body: JSON.stringify({ action: "enrol", payload: input.payload }),
  });

  if (!response.ok) {
    const message = await handleProtectedResponse(response, input.onUnauthorized);
    return {
      ok: false,
      message: message ?? "We couldn't start matching. Please try again.",
    };
  }

  const parsed = enrolResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return {
      ok: false,
      message: "The matching service returned an invalid response. Please try again.",
    };
  }

  return { ok: true, data: { matchId: parsed.data.matchId ?? null } };
}

export async function cancelMatchingRequest(input: {
  onUnauthorized: () => void;
}): Promise<MatchingRequestResult<{ success: true }>> {
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/matching", {
    method: "DELETE",
    headers: { [CSRF_HEADER_NAME]: csrfToken },
  });

  if (!response.ok) {
    const message = await handleProtectedResponse(response, input.onUnauthorized);
    return {
      ok: false,
      message: message ?? "We couldn't cancel the search. Please try again.",
    };
  }

  const parsed = cancelResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return {
      ok: false,
      message: "The matching service returned an invalid response. Please try again.",
    };
  }

  return { ok: true, data: parsed.data };
}
