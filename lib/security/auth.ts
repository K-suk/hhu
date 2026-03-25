import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  AuthenticationError,
  ForbiddenError,
} from "@/lib/security/errors";
import { extractEmailDomain } from "@/lib/validations/auth";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type UniversityRow = Database["public"]["Tables"]["university"]["Row"];

export type AuthSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User & {
    email_domain: string;
  };
  profile: Pick<
    ProfileRow,
    | "id"
    | "email_domain"
    | "gender_identity"
    | "status"
    | "display_name"
    | "department"
  > | null;
};

type AuthRequirementOptions = {
  requireEmailVerified?: boolean;
  requireProfileComplete?: boolean;
  requireUniversityUnlocked?: boolean;
};

export function hasCompletedProfile(profile: AuthSession["profile"]): boolean {
  return Boolean(profile?.display_name && profile.department && profile.gender_identity);
}

export async function requireAuth(): Promise<AuthSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthenticationError();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email_domain, gender_identity, status, display_name, department",
    )
    .eq("id", user.id)
    .maybeSingle();

  const emailDomain = (
    profile?.email_domain ?? extractEmailDomain(user.email ?? "")
  )
    ?.trim()
    .toLowerCase();

  if (!emailDomain) {
    throw new AuthenticationError("Unauthorized");
  }

  return {
    supabase,
    user: Object.assign(user, {
      email_domain: emailDomain,
    }),
    profile: profile ?? null,
  };
}

export async function requireEligibleUser(
  options: AuthRequirementOptions = {},
): Promise<AuthSession> {
  const {
    requireEmailVerified = true,
    requireProfileComplete = false,
    requireUniversityUnlocked = false,
  } = options;
  const session = await requireAuth();

  if (requireEmailVerified && !session.user.email_confirmed_at) {
    throw new ForbiddenError("Email verification required.");
  }

  if (requireProfileComplete && !hasCompletedProfile(session.profile)) {
    throw new ForbiddenError("Complete your profile to continue.");
  }

  if (requireUniversityUnlocked) {
    const { data: university } = await session.supabase
      .from("university")
      .select("is_unlocked")
      .eq("email_domain", session.user.email_domain)
      .maybeSingle<Pick<UniversityRow, "is_unlocked">>();

    if (!university?.is_unlocked) {
      throw new ForbiddenError("Your university is not unlocked yet.");
    }
  }

  return session;
}
