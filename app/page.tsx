import { redirect } from "next/navigation";

import { MatchingHub } from "@/components/matching/matching-hub";
import { SessionRecoveryProvider } from "@/components/recovery/session-recovery-provider";
import { createClient } from "@/lib/supabase/server";
import { extractEmailDomain } from "@/lib/university/email-domain";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("gender_identity, email_domain")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile?.gender_identity) {
    redirect("/setup");
  }

  const emailDomain = profile.email_domain ?? extractEmailDomain(user.email ?? "");

  if (!emailDomain) {
    redirect("/setup");
  }

  // Include "finished": one user has graded; the other must still reach chat/grading.
  const { data: ongoingMatches, error: ongoingMatchError } = await supabase
    .from("matches")
    .select("id")
    .or(`user_1.eq.${user.id},user_2.eq.${user.id}`)
    .in("status", ["active", "finished"])
    .order("created_at", { ascending: false })
    .limit(1);

  if (!ongoingMatchError && ongoingMatches && ongoingMatches.length > 0) {
    redirect(`/chat/${ongoingMatches[0].id}`);
  }

  const { data: queueRows } = await supabase
    .from("queues")
    .select("course_id")
    .eq("user_id", user.id)
    .limit(1);

  const pendingCourseId = queueRows?.[0]?.course_id ?? null;

  const { data: university } = await supabase
    .from("university")
    .select("name")
    .eq("email_domain", emailDomain)
    .maybeSingle();

  return (
    <SessionRecoveryProvider userId={user.id}>
      <MatchingHub
        userId={user.id}
        genderIdentity={profile.gender_identity}
        emailDomain={emailDomain}
        universityName={university?.name ?? null}
        pendingCourseId={pendingCourseId}
      />
    </SessionRecoveryProvider>
  );
}
