"use client";

import Link from "next/link";

type ErrorPageProps = {
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background-taproom px-6 pb-24 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-rose-300/25 bg-stone-900/80 p-6 text-center shadow-2xl">
        <span
          className="material-symbols-outlined text-4xl text-rose-300"
          aria-hidden="true"
        >
          error
        </span>
        <h1 className="mt-3 text-2xl font-bold">We couldn&apos;t load this page</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Your data was not changed. Check your connection and try again.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-full bg-primary-amber px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300"
          >
            Try again
          </button>
          <Link
            href="/"
            className="flex min-h-11 items-center justify-center rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
          >
            Back to Taproom
          </Link>
        </div>
      </section>
    </main>
  );
}
