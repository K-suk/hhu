import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/security/auth";
import { ChatRoom } from "@/components/chat/chat-room";
import { getExistingUserRatingForMatch, requireMatchParticipant } from "@/lib/security/authz";
import { AuthenticationError, ForbiddenError } from "@/lib/security/errors";

type ChatPageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const { matchId } = await params;
  let chatRoomProps: React.ComponentProps<typeof ChatRoom>;

  try {
    const session = await requireAuth();
    const authorizedMatch = await requireMatchParticipant(session, matchId);
    const existingRating = await getExistingUserRatingForMatch(session, authorizedMatch.match.id);

    if (existingRating) {
      redirect("/");
    }

    chatRoomProps = {
      currentUserId: session.user.id,
      match: authorizedMatch.match,
      initialMessages: [],
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect("/login");
    }

    if (error instanceof ForbiddenError) {
      redirect("/");
    }

    throw error;
  }

  return <ChatRoom {...chatRoomProps} />;
}
