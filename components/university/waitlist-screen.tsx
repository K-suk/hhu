"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type UniversityRow = Database["public"]["Tables"]["university"]["Row"];

type WaitlistScreenProps = {
  emailDomain: string;
  initialUniversity: UniversityRow | null;
};

export function WaitlistScreen({
  emailDomain,
  initialUniversity,
}: WaitlistScreenProps) {
  const supabase = useMemo(() => createClient(), []);
  const [university, setUniversity] = useState<UniversityRow | null>(
    initialUniversity,
  );

  useEffect(() => {
    let active = true;

    async function refreshUniversity() {
      const { data } = await supabase
        .from("university")
        .select(
          "email_domain, name, min_age, is_unlocked, unlock_threshold, user_count, created_at",
        )
        .eq("email_domain", emailDomain)
        .maybeSingle();

      if (!active) {
        return;
      }

      setUniversity(data ?? null);
    }

    const channel = supabase
      .channel(`university:${emailDomain}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "university",
          filter: `email_domain=eq.${emailDomain}`,
        },
        () => {
          void refreshUniversity();
        },
      )
      .subscribe();

    void refreshUniversity();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [emailDomain, supabase]);

  const currentStudents = university?.user_count ?? 0;
  const unlockThreshold = university?.unlock_threshold ?? 10;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#10261a_0%,#040507_45%,#000_100%)] px-6 py-10 font-mono text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center gap-6 rounded-3xl border border-[#00ff00]/30 bg-black/70 p-6 shadow-[0_0_40px_rgba(0,255,0,0.12)]">
        <div className="rounded-xl border border-[#00ff00]/30 bg-[#00ff00]/5 p-3 text-xs tracking-wider text-[#86ff86] uppercase">
          branch status: construction
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold leading-tight text-[#c9ffb3]">
            Waitlist
          </h1>
          <p className="text-sm text-slate-300">
            Your domain is <span className="text-[#00ff00]">{emailDomain}</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-200">
            Current Students: {currentStudents} / {unlockThreshold}
          </p>
        </div>

        <p className="text-sm leading-relaxed text-slate-300">
          {unlockThreshold} students required to open the {emailDomain} branch.
          Share with your classmates!
        </p>
      </div>
    </main>
  );
}
