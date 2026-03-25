import type { Database } from "@/lib/supabase/database.types";
import type { AuthSession } from "@/lib/security/auth";
import { logSecurityEvent } from "@/lib/security/audit";
import { ForbiddenError } from "@/lib/security/errors";

type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type RatingRow = Database["public"]["Tables"]["ratings"]["Row"];

type AuthorizedMatch = {
  match: MatchRow;
  partnerUserId: string;
  emailDomain: string;
};

type AllowedMatchStatus = MatchRow["status"];

const MATCH_LOOKUP_RETRY_DELAYS_MS = [150, 300, 500] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throwForbidden(
  session: AuthSession,
  action: string,
  resourceId: string,
  detail: string,
): never {
  logSecurityEvent({
    action,
    userId: session.user.id,
    resourceId,
    detail,
  });

  throw new ForbiddenError();
}

export async function requireMatchParticipant(
  session: AuthSession,
  matchId: string,
): Promise<AuthorizedMatch> {
  let match: MatchRow | null = null;
  let error: unknown = null;

  for (const retryDelayMs of [0, ...MATCH_LOOKUP_RETRY_DELAYS_MS]) {
    if (retryDelayMs > 0) {
      await sleep(retryDelayMs);
    }

    const result = await session.supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    match = result.data;
    error = result.error;

    if (match || result.error) {
      break;
    }
  }

  if (error || !match) {
    throwForbidden(session, "match_access_denied", matchId, "missing_match");
  }

  const isParticipant =
    match.user_1 === session.user.id || match.user_2 === session.user.id;

  if (!isParticipant) {
    throwForbidden(session, "match_access_denied", matchId, "not_participant");
  }

  const { data: isDomainConsistent, error: domainConsistencyError } =
    await session.supabase.rpc("is_match_domain_consistent", {
      target_match_id: matchId,
    });

  if (domainConsistencyError || !isDomainConsistent) {
    throwForbidden(
      session,
      "match_access_denied",
      matchId,
      domainConsistencyError
        ? "participant_domain_lookup_failed"
        : "domain_mismatch",
    );
  }

  const sessionDomain = session.user.email_domain;

  if (!sessionDomain) {
    throwForbidden(
      session,
      "domain_integrity_failed",
      matchId,
      "missing_session_domain",
    );
  }

  const partnerUserId =
    match.user_1 === session.user.id ? match.user_2 : match.user_1;

  if (!partnerUserId) {
    throwForbidden(session, "match_access_denied", matchId, "missing_partner_user");
  }

  return {
    match,
    partnerUserId,
    emailDomain: sessionDomain,
  };
}

export function assertRequestedDomain(
  session: AuthSession,
  requestedDomain: string,
) {
  const normalizedRequestedDomain = requestedDomain.trim().toLowerCase();

  if (normalizedRequestedDomain !== session.user.email_domain) {
    logSecurityEvent({
      action: "domain_integrity_failed",
      userId: session.user.id,
      resourceId: requestedDomain,
      detail: "requested_domain_mismatch",
    });
    throw new ForbiddenError();
  }
}

export function assertProfileGenderIdentity(
  session: AuthSession,
  requestedGenderIdentity: string,
) {
  if (!session.profile?.gender_identity) {
    logSecurityEvent({
      action: "profile_integrity_failed",
      userId: session.user.id,
      detail: "missing_profile_gender_identity",
    });
    throw new ForbiddenError();
  }

  if (session.profile.gender_identity !== requestedGenderIdentity) {
    logSecurityEvent({
      action: "profile_integrity_failed",
      userId: session.user.id,
      resourceId: requestedGenderIdentity,
      detail: "gender_identity_mismatch",
    });
    throw new ForbiddenError();
  }
}

export function assertRatedUserIsPartner(
  session: AuthSession,
  matchId: string,
  ratedUserId: string,
  partnerUserId: string,
) {
  if (ratedUserId !== partnerUserId) {
    throwForbidden(
      session,
      "rating_access_denied",
      matchId,
      "rated_user_mismatch",
    );
  }
}

export function assertMatchStatus(
  session: AuthSession,
  match: MatchRow,
  allowedStatuses: AllowedMatchStatus[],
  action: string,
) {
  if (allowedStatuses.includes(match.status)) {
    return;
  }

  throwForbidden(
    session,
    action,
    match.id,
    `invalid_match_status:${match.status ?? "null"}`,
  );
}

export async function getExistingUserRatingForMatch(
  session: AuthSession,
  matchId: string,
): Promise<RatingRow | null> {
  const { data, error } = await session.supabase
    .from("ratings")
    .select(
      "id, match_id, rater_user_id, rated_user_id, grade_point, created_at",
    )
    .eq("match_id", matchId)
    .eq("rater_user_id", session.user.id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
