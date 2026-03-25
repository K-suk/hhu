import { redirect } from "next/navigation";

import { VerifyEmailClient } from "@/app/verify-email/verify-email-client";
import { createClient } from "@/lib/supabase/server";

export default async function VerifyEmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (user.email_confirmed_at) {
    redirect("/");
  }

  return <VerifyEmailClient email={user.email ?? ""} />;
}
