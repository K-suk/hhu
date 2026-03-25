import { redirect } from "next/navigation";

import { SetupForm } from "@/app/setup/setup-form";
import { createClient } from "@/lib/supabase/server";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, department, gender_identity, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!error && profile?.display_name && profile?.department && profile?.gender_identity) {
    redirect("/");
  }

  return <SetupForm userId={user.id} initialAvatarUrl={profile?.avatar_url ?? null} />;
}
