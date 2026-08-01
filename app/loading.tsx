export default function LoadingPage() {
  return (
    <main
      className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background-taproom px-6 pb-24 text-slate-100"
      aria-busy="true"
    >
      <section className="w-full max-w-md rounded-2xl border border-primary-amber/20 bg-stone-900/70 p-6 text-center">
        <span
          className="material-symbols-outlined animate-pulse text-4xl text-primary-amber"
          aria-hidden="true"
        >
          hourglass_top
        </span>
        <h1 className="mt-3 text-xl font-bold">Loading HHU</h1>
        <p className="mt-2 font-mono text-sm text-slate-400" role="status">
          Checking your session and preparing the next screen...
        </p>
        <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary-amber" />
        </div>
      </section>
    </main>
  );
}
