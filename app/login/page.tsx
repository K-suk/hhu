import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background-dark font-display text-zinc-100 selection:bg-primary-amber selection:text-black">
      {/* Gradient overlay */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-background-dark/90 via-background-dark/80 to-background-dark/95" />
      {/* Subtle grid pattern */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(255,177,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,177,0,0.03)_1px,transparent_1px)] bg-[size:30px_30px]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-6 py-8 md:max-w-4xl md:px-10 lg:max-w-5xl">
        {/* Neon sign section */}
        <div className="mt-4 mb-8 flex shrink-0 flex-col items-center gap-6">
          <div className="font-mono text-sm uppercase tracking-[0.3em] text-primary-amber/60 z-10">
            HHU
          </div>
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-primary-amber/20 blur-xl" />
            <div className="relative rounded-xl border-4 border-primary-amber/30 bg-black/40 px-8 py-3 shadow-[0_0_30px_rgba(255,177,0,0.2)] backdrop-blur-sm">
              <h1
                className="neon-text text-center text-5xl font-bold tracking-tighter text-primary-amber"
                style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
              >
                OPEN
              </h1>
            </div>
            <div className="absolute -top-12 left-1/2 h-12 w-0.5 -translate-x-1/2 bg-stone-700/80" />
          </div>
          <p className="mt-2 max-w-[200px] text-center text-sm font-light text-slate-400">
            Student Access Only.
            <br />
            Show your ID at the door.
          </p>
        </div>

        {/* Auth form */}
        <div className="w-full">
          <AuthForm />
        </div>

        {/* Bottom decorative dots */}
        <div className="mb-4 mt-8 flex justify-center gap-2 opacity-30">
          <div className="h-1 w-1 rounded-full bg-primary-amber" />
          <div className="h-1 w-1 rounded-full bg-primary-amber" />
          <div className="h-1 w-1 rounded-full bg-primary-amber" />
        </div>
      </div>
    </main>
  );
}
