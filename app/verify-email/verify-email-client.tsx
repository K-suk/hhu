"use client";

import { useActionState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import { resendVerificationEmailAction } from "@/app/verify-email/actions";
import { createClient } from "@/lib/supabase/client";
import { INITIAL_AUTH_STATE } from "@/lib/validations/auth";

type VerifyEmailClientProps = {
  email: string;
};

export function VerifyEmailClient({ email }: VerifyEmailClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [state, formAction] = useActionState(
    resendVerificationEmailAction,
    INITIAL_AUTH_STATE,
  );

  const goNextIfVerified = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email_confirmed_at) {
      router.replace("/");
      router.refresh();
    }
  }, [router, supabase.auth]);

  useEffect(() => {
    void goNextIfVerified();

    const pollId = window.setInterval(() => {
      void goNextIfVerified();
    }, 3000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at) {
        router.replace("/");
        router.refresh();
      }
    });

    return () => {
      window.clearInterval(pollId);
      subscription.unsubscribe();
    };
  }, [goNextIfVerified, router, supabase.auth]);

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-black px-4 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.08)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.2),transparent_45%),radial-gradient(circle_at_bottom,rgba(255,179,0,0.12),transparent_40%)]" />

      <section className="relative z-10 w-full max-w-xl rounded-2xl border border-emerald-400/30 bg-black/70 p-6 font-mono shadow-[0_0_40px_rgba(16,185,129,0.12)] backdrop-blur">
        <p className="text-xs tracking-[0.2em] text-emerald-400/70 uppercase">
          HHU Security Gateway
        </p>
        <h1 className="mt-4 text-lg leading-relaxed tracking-wider text-emerald-300 md:text-xl">
          &gt; ACCESS DENIED: Identity verification required.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          A verification link has been sent to your student terminal (email). Please check your inbox to establish a secure session.
        </p>
        <p className="mt-2 break-all text-xs text-emerald-400/80">{email}</p>

        {state.status === "success" && state.message ? (
          <p className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
            {state.message}
          </p>
        ) : null}

        {state.status === "error" && state.message ? (
          <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
            {state.message}
          </p>
        ) : null}

        <form action={formAction}>
          <ResendButton disabled={!email} />
        </form>
      </section>
    </main>
  );
}

function ResendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="mt-6 inline-flex items-center justify-center rounded-md border border-primary-amber/50 bg-primary-amber/10 px-4 py-2 text-sm font-semibold tracking-wider text-primary-amber uppercase transition hover:bg-primary-amber hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Resending..." : "Resend Verification Email"}
    </button>
  );
}
