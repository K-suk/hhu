import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/security/auth";
import { GradeSelectionCard } from "@/components/grading/grade-selection-card";
import { getExistingUserRatingForMatch, requireMatchParticipant } from "@/lib/security/authz";
import { AuthenticationError, ForbiddenError } from "@/lib/security/errors";

type GradingPageProps = {
  params: Promise<{ matchId: string }>;
};

export default async function GradingPage({ params }: GradingPageProps) {
  const { matchId } = await params;
  try {
    const session = await requireAuth();
    const authorizedMatch = await requireMatchParticipant(session, matchId);

    if (authorizedMatch.match.status === "reported") {
      redirect("/");
    }

    const existingGrade = await getExistingUserRatingForMatch(
      session,
      authorizedMatch.match.id,
    );

    if (existingGrade) {
      await session.supabase.rpc("set_profile_idle");
      redirect("/");
    }

    return (
      <GradeSelectionCard
        matchId={authorizedMatch.match.id}
        courseLabel={authorizedMatch.match.course_id ?? "Unknown Course"}
        ratedUserId={authorizedMatch.partnerUserId}
        userId={session.user.id}
      />
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect("/login");
    }

    if (error instanceof ForbiddenError) {
      redirect("/");
    }

    throw error;
  }
}
