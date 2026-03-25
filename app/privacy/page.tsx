import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | HHU",
  description:
    "Privacy Policy for Happy Hour University (HHU): domain authentication, age verification, daily reset, and liability disclaimer.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13290f_0%,#07090b_45%,#020202_100%)] px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex justify-start">
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center gap-2 rounded-full border border-primary-amber/30 bg-black/40 px-4 py-2 text-sm font-medium text-primary-amber transition-colors hover:bg-primary-amber/10"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to sign up
          </Link>
        </div>
        <div className="rounded-3xl border border-primary-amber/25 bg-black/45 p-5 shadow-[0_0_28px_rgba(255,177,0,0.14)] backdrop-blur sm:p-8">
          <header className="mb-8 border-b border-white/10 pb-5">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary-amber/80">
              HHU
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-zinc-300">
              Effective date: February 27, 2026
            </p>
            <p className="mt-3 text-sm text-zinc-300">
              Reviewing signup rules before joining? You can head straight back to
              enrollment anytime.
            </p>
          </header>

          <div className="space-y-6 text-sm leading-relaxed text-zinc-200 sm:text-[15px]">
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                1. University Domain Authentication
              </h2>
              <p>
                HHU uses your university email domain to determine eligibility and
                to apply university-specific policies. When you sign up, we process
                your email address and extract only the domain portion (for example,
                <span className="font-mono text-primary-amber"> ubc.ca</span>) for
                policy matching and account setup.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                2. Age Verification (19+/21+ by Domain)
              </h2>
              <p>
                HHU enforces a minimum age requirement based on university domain.
                Known university domains use the minimum age stored in HHU systems.
                For unknown domains, HHU applies a heuristic: domains ending in
                <span className="font-mono text-primary-amber"> .edu</span> require
                age 21+, and all other domains require age 19+.
              </p>
              <p className="mt-2">
                Your date of birth is used only to verify that you meet the required
                minimum age for your domain at signup.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                3. The Daily Reset &amp; Safety Logging
              </h2>
              <p className="mb-3 leading-relaxed">
                <strong>Privacy Purge:</strong> HHU is designed for ephemeral social
                matching. All active matches, chat messages, and queue data are
                automatically deleted every day at{" "}
                <span className="font-mono text-primary-amber">4:00 AM PST</span>.
                Once deleted, this data cannot be recovered for any reason.
              </p>
              <p className="text-sm italic leading-relaxed text-zinc-300">
                <strong>Safety Exception:</strong> To handle reports of harassment
                or violations, HHU may retain minimal metadata (User IDs,
                timestamps, and report history) for a limited period to conduct
                investigations and enforce bans. These safety logs do not include
                message content or the substance of your conversations.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                4. Alcohol-Related Liability Disclaimer
              </h2>
              <p>
                HHU does not sell, serve, or distribute alcohol and does not
                supervise in-person interactions between users. You are solely
                responsible for your own decisions, conduct, and legal compliance.
                By using HHU, you acknowledge that HHU is not liable for alcohol
                consumption outcomes, user conduct, or any incidents arising from
                offline meetings.
              </p>
            </section>
          </div>

          <footer className="mt-8 border-t border-white/10 pt-4 text-xs text-zinc-400">
            By continuing to use HHU, you acknowledge this Privacy Policy and
            related platform rules. For service terms, see
            <Link href="/terms" className="ml-1 text-blue-400 underline">
              Terms of Service
            </Link>
            .
          </footer>
        </div>
      </div>
    </main>
  );
}
