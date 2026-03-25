import { redirect } from "next/navigation";

import { ProfilePageClient } from "@/components/profile/profile-page-client";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect("/setup");
  }

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("*")
    .or(`user_1.eq.${user.id},user_2.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(10);

  const safeMatches: MatchRow[] = matchesError ? [] : (matches ?? []);

  return (
    <ProfilePageClient
      userId={user.id}
      initialProfile={profile}
      recentMatches={safeMatches}
    />
  );
}
