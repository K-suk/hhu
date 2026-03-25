"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function SuspendedPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);

    // Even if signOut fails (rare), force navigation to login.
    if (!error) {
      router.replace("/login");
      return;
    }

    router.replace("/login");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-stone-950 px-4 font-display text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,60,60,0.06)_0%,transparent_60%)]" />
      <div className="pointer-events-none fixed inset-0 z-10 opacity-15 [background-image:linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0)_50%,rgba(0,0,0,0.2)_50%,rgba(0,0,0,0.2)_100%)] [background-size:100%_4px]" />

      <div className="relative z-20 w-full max-w-md text-center">
        <div className="mb-6 inline-flex size-20 items-center justify-center rounded-full border-2 border-rose-400/30 bg-rose-950/40">
          <span className="material-symbols-outlined text-5xl text-rose-400/80">
            gavel
          </span>
        </div>

        <h1 className="font-mono text-2xl font-bold tracking-tight text-rose-200">
          Account Suspended
        </h1>

        <p className="mt-3 font-mono text-sm leading-relaxed text-slate-400">
          Your account has been temporarily suspended pending review by the
          Academic Board. This may be due to a report filed against your account.
        </p>

        <div className="mt-6 rounded-xl border border-rose-400/20 bg-rose-950/30 px-4 py-3">
          <p className="font-mono text-xs leading-relaxed text-slate-500">
            If you believe this is an error, please contact support through your
            university&apos;s official channels. Your account will be reinstated
            if the review clears you.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isSigningOut}
          className="mt-8 w-full rounded-full border border-rose-400/25 bg-rose-600/15 px-4 py-3 font-mono text-sm font-semibold text-rose-100 transition hover:bg-rose-600/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? "Logging out..." : "Logout"}
        </button>

        <p className="mt-4 font-mono text-[10px] tracking-wider text-slate-600 uppercase">
          HHU — Alcohol Integrity Office
        </p>
      </div>
    </main>
  );
}
