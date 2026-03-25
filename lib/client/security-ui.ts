import { z } from "zod";

const HTML_TAG_PATTERN = /<[^>]*>/g;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
/** Control chars unsafe in plain text, excluding tab/newline/carriage return (multiline fields). */
const DANGEROUS_CONTROL_WITHOUT_NEWLINE_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const CLIENT_ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const CLIENT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function sanitizePlainTextInput(value: string): string {
  return value
    .replace(HTML_TAG_PATTERN, "")
    .replace(CONTROL_CHAR_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * For textarea / multiline user content: strips HTML and dangerous control characters
 * but preserves spaces, tabs, and newlines (no collapse, no trim).
 */
export function sanitizeMultilinePlainTextInput(value: string): string {
  return value
    .replace(HTML_TAG_PATTERN, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(DANGEROUS_CONTROL_WITHOUT_NEWLINE_PATTERN, "");
}

export function sanitizeInlineTextInput(value: string): string {
  return value
    .replace(HTML_TAG_PATTERN, "")
    .replace(CONTROL_CHAR_PATTERN, " ");
}

export function getFriendlyErrorMessage(
  input: { status?: number; message?: string | null } | string | null | undefined,
): string {
  const status = typeof input === "string" ? undefined : input?.status;
  const rawMessage = typeof input === "string" ? input : input?.message ?? "";
  const message = rawMessage.trim();

  if (status === 401) {
    return "Your session expired. Please sign in again.";
  }

  if (status === 403) {
    return "Permission denied for that action.";
  }

  if (status === 429) {
    return message || "Too many attempts. Please wait and try again.";
  }

  if (/csrf|forbidden|permission/i.test(message)) {
    return "Permission denied for that action.";
  }

  if (/unauthorized|session/i.test(message)) {
    return "Your session expired. Please sign in again.";
  }

  if (/network|fetch|timeout/i.test(message)) {
    return "Network issue detected. Please try again.";
  }

  if (/postgres|supabase|sql|42703|stack|trace/i.test(message)) {
    return "Something went wrong. Please try again.";
  }

  if (message.length > 0 && message.length < 120) {
    return message;
  }

  return "Something went wrong. Please try again.";
}

export async function parseErrorResponse(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; retryAfter?: number }
    | null;

  return getFriendlyErrorMessage({
    status: response.status,
    message: payload?.message ?? null,
  });
}

export async function handleProtectedResponse(
  response: Response,
  onUnauthorized: () => void,
): Promise<string | null> {
  if (response.ok) {
    return null;
  }

  if (response.status === 401) {
    onUnauthorized();
  }

  return parseErrorResponse(response);
}

export function firstZodIssue(error: z.ZodError): string {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;

  for (const issues of Object.values(flattened)) {
    if (issues?.[0]) {
      return issues[0];
    }
  }

  return "Please check your input and try again.";
}

export function validateImageFile(file: File): string | null {
  if (!CLIENT_ALLOWED_IMAGE_TYPES.includes(file.type as (typeof CLIENT_ALLOWED_IMAGE_TYPES)[number])) {
    return "Use a JPG, PNG, or WEBP image.";
  }

  if (file.size > CLIENT_MAX_IMAGE_BYTES) {
    return "Image must be 5MB or smaller.";
  }

  return null;
}
