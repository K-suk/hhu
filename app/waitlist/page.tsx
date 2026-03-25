import { redirect } from "next/navigation";

import { WaitlistScreen } from "@/components/university/waitlist-screen";
import { createClient } from "@/lib/supabase/server";
import { extractEmailDomain } from "@/lib/university/email-domain";

export default async function WaitlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_domain")
    .eq("id", user.id)
    .maybeSingle();

  const emailDomain = profile?.email_domain ?? extractEmailDomain(user.email ?? "");

  if (!emailDomain) {
    redirect("/setup");
  }

  const { data: university } = await supabase
    .from("university")
    .select(
      "email_domain, name, min_age, is_unlocked, unlock_threshold, user_count, created_at",
    )
    .eq("email_domain", emailDomain)
    .maybeSingle();

  if (university?.is_unlocked) {
    redirect("/");
  }

  return (
    <WaitlistScreen
      emailDomain={emailDomain}
      initialUniversity={university ?? null}
    />
  );
}
