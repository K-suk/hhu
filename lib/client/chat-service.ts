import { z } from "zod";

import { handleProtectedResponse } from "@/lib/client/security-ui";
import { getCsrfToken } from "@/lib/security/csrf-client";
import { CSRF_HEADER_NAME } from "@/lib/security/csrf-shared";
import type { Database } from "@/lib/supabase/database.types";

type Message = Database["public"]["Tables"]["messages"]["Row"];

const messageSchema = z.object({
  id: z.string(),
  match_id: z.string().nullable(),
  sender_id: z.string().nullable(),
  content: z.string(),
  created_at: z.string().nullable(),
});

const sendMessageResponseSchema = z.object({
  message: messageSchema.optional(),
});

const reportResponseSchema = z.object({
  success: z.literal(true),
});

export type RequestResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export async function sendChatMessageRequest(input: {
  matchId: string;
  content: string;
  onUnauthorized: () => void;
}): Promise<RequestResult<{ message?: Message }>> {
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CSRF_HEADER_NAME]: csrfToken,
    },
    body: JSON.stringify({
      match_id: input.matchId,
      content: input.content,
    }),
  });

  if (!response.ok) {
    const message = await handleProtectedResponse(response, input.onUnauthorized);
    return { ok: false, message: message ?? "Failed to send message." };
  }

  const parsed = sendMessageResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return {
      ok: false,
      message: "Failed to read server response. Please try again.",
    };
  }

  return { ok: true, data: parsed.data };
}

export type ReportInput = {
  category: "Harassment" | "Fake Profile" | "No-show" | "Other";
  details: string;
};

export async function submitMatchReportRequest(input: {
  matchId: string;
  report: ReportInput;
  onUnauthorized: () => void;
}): Promise<RequestResult<{ success: true }>> {
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/matching", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [CSRF_HEADER_NAME]: csrfToken,
    },
    body: JSON.stringify({
      action: "report",
      payload: {
        match_id: input.matchId,
        category: input.report.category,
        details: input.report.details,
      },
    }),
  });

  if (!response.ok) {
    const message = await handleProtectedResponse(response, input.onUnauthorized);
    return {
      ok: false,
      message:
        message ??
        "We couldn't submit your report. Please try again or contact support.",
    };
  }

  const parsed = reportResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return {
      ok: false,
      message: "The reporting service returned an invalid response. Please try again.",
    };
  }

  return { ok: true, data: parsed.data };
}
