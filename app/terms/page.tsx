import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | HHU",
  description:
    "Terms of Service for Happy Hour University (HHU): eligibility, age gate, daily reset, safety logs, liability disclaimer, and user conduct.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#13290f_0%,#07090b_45%,#020202_100%)] px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex justify-start">
          <Link
            href="/login?mode=signup"
            className="inline-flex items-center gap-2 rounded-full border border-primary-amber/30 bg-black/40 px-4 py-2 text-sm font-medium text-primary-amber transition-colors hover:bg-primary-amber/10"
          >
            <span className="material-symbols-outlined text-base">
              arrow_back
            </span>
            Back to sign up
          </Link>
        </div>

        <div className="rounded-3xl border border-primary-amber/25 bg-black/45 p-5 shadow-[0_0_28px_rgba(255,177,0,0.14)] backdrop-blur sm:p-8">
          <header className="mb-8 border-b border-white/10 pb-5">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary-amber/80">
              HHU
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm text-zinc-300">
              Effective date: February 27, 2026
            </p>
          </header>

          <div className="space-y-6 text-sm leading-relaxed text-zinc-200 sm:text-[15px]">
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                1. Acceptance of Terms
              </h2>
              <p>
                By creating an account or using Happy Hour University
                (&quot;HHU&quot;), you agree to be bound by these Terms of
                Service. If you do not agree, you must not use HHU.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                2. Eligibility &amp; Age Requirement
              </h2>
              <p>
                HHU is exclusively available to verified university students.
                You must authenticate with a valid university email address to
                register. HHU enforces a strict minimum age requirement that
                varies by university domain:
              </p>
              <ul className="mt-3 list-inside list-disc space-y-1.5 pl-2 text-zinc-300">
                <li>
                  Known university domains use the minimum age configured in HHU
                  systems.
                </li>
                <li>
                  Domains ending in
                  <span className="font-mono text-primary-amber"> .edu</span>
                  {" "}require age
                  <span className="font-mono text-primary-amber"> 21+</span>.
                </li>
                <li>
                  All other domains require age
                  <span className="font-mono text-primary-amber"> 19+</span>.
                </li>
              </ul>
              <p className="mt-3">
                You represent and warrant that the date of birth you provide is
                accurate. Misrepresentation of age is grounds for immediate
                account termination.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                3. The Daily Reset &amp; Safety Logging
              </h2>
              <p className="mb-3 leading-relaxed">
                <strong>Privacy Purge:</strong> All active matches, chat messages,
                and queue data are automatically deleted every day at{" "}
                <span className="font-mono text-primary-amber">4:00 AM PST</span>.
                We cannot recover deleted messages for any reason.
              </p>
              <p className="text-sm italic leading-relaxed text-zinc-300">
                <strong>Safety Exception:</strong> To handle reports of harassment
                or violations, HHU may retain minimal metadata (User IDs,
                timestamps, and report history) for a limited period to conduct
                investigations and enforce bans.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                5. Alcohol-Related Liability Disclaimer
              </h2>
              <p>
                HHU does not sell, serve, distribute, or promote alcohol. HHU
                does not supervise, facilitate, or endorse in-person meetings
                between users. By using HHU, you expressly acknowledge and agree
                that:
              </p>
              <ul className="mt-3 list-inside list-disc space-y-1.5 pl-2 text-zinc-300">
                <li>
                  You are solely responsible for your own decisions, conduct, and
                  compliance with local laws regarding alcohol consumption.
                </li>
                <li>
                  HHU bears no liability for any outcomes resulting from
                  alcohol consumption, user conduct, or incidents arising from
                  offline meetings.
                </li>
                <li>
                  HHU does not verify or guarantee the behaviour, intentions, or
                  sobriety of any user.
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                6. User Conduct
              </h2>
              <p>You agree not to:</p>
              <ul className="mt-3 list-inside list-disc space-y-1.5 pl-2 text-zinc-300">
                <li>
                  Harass, threaten, or engage in abusive behaviour toward other
                  users.
                </li>
                <li>
                  Impersonate another person or misrepresent your university
                  affiliation.
                </li>
                <li>
                  Use HHU for any unlawful purpose or to facilitate illegal
                  activity.
                </li>
                <li>
                  Attempt to circumvent the daily reset, age verification, or
                  any other platform safeguard.
                </li>
              </ul>
              <p className="mt-3">
                Violation of these rules may result in immediate account
                suspension or termination without notice.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                7. Limitation of Liability
              </h2>
              <p>
                HHU is provided &quot;as is&quot; and &quot;as available&quot;
                without warranties of any kind, express or implied. To the
                fullest extent permitted by law, HHU disclaims all liability for
                damages arising from your use of the platform, including but not
                limited to direct, indirect, incidental, or consequential
                damages.
              </p>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">
                8. Changes to These Terms
              </h2>
              <p>
                HHU reserves the right to update these Terms of Service at any
                time. Continued use of HHU after changes are posted constitutes
                acceptance of the revised terms. Material changes will be
                communicated via in-app notice or email.
              </p>
            </section>
          </div>

          <footer className="mt-8 border-t border-white/10 pt-4 text-xs text-zinc-400">
            By continuing to use HHU, you acknowledge these Terms of Service and
            related platform rules. For data practices, see
            <Link href="/privacy" className="ml-1 text-blue-400 underline">
              Privacy Policy
            </Link>
            .
          </footer>
        </div>
      </div>
    </main>
  );
}
