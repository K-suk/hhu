import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background-taproom px-6 pb-24 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-primary-amber/20 bg-stone-900/75 p-6 text-center">
        <p className="font-mono text-sm tracking-[0.25em] text-primary-amber">404</p>
        <h1 className="mt-3 text-2xl font-bold">This course isn&apos;t on the schedule</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          The link may be outdated, or the page may have moved.
        </p>
        <Link
          href="/"
          className="mt-6 flex min-h-11 w-full items-center justify-center rounded-full bg-primary-amber px-4 py-2.5 text-sm font-bold text-black hover:bg-amber-300"
        >
          Back to Taproom
        </Link>
      </section>
    </main>
  );
}
