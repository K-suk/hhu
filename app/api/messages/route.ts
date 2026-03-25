import { sendMessageSchema } from "@/lib/validations/matching";
import { assertMatchStatus, requireMatchParticipant } from "@/lib/security/authz";
import { requireEligibleUser } from "@/lib/security/auth";
import { withCsrfProtect } from "@/lib/security/csrf";
import { authedJsonRoute } from "@/lib/security/route";
import {
  checkRateLimitForSession,
  createRateLimitResponse,
} from "@/lib/security/rate-limit";

const sendMessageRequestSchema = sendMessageSchema.pick({
  match_id: true,
  content: true,
});

export const POST = withCsrfProtect(
  authedJsonRoute(
    sendMessageRequestSchema,
    async (data, session, request) => {
      const rateLimit = await checkRateLimitForSession("general", session, request);
      if (!rateLimit.success) {
        return createRateLimitResponse(
          rateLimit,
          request,
          "Too many messages sent. Please slow down.",
        );
      }

      const authorizedMatch = await requireMatchParticipant(session, data.match_id);
      assertMatchStatus(
        session,
        authorizedMatch.match,
        ["active"],
        "message_send_denied",
      );

      const { data: insertedMessage, error } = await session.supabase
        .from("messages")
        .insert({
          match_id: data.match_id,
          sender_id: session.user.id,
          content: data.content,
        })
        .select("id, match_id, sender_id, content, created_at")
        .single();

      if (error) {
        return Response.json(
          { message: "Failed to send message." },
          { status: 500 },
        );
      }

      return {
        message: insertedMessage,
      };
    },
    () => requireEligibleUser({ requireProfileComplete: true }),
  ),
);
