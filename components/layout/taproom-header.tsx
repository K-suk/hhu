"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function TaproomHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isSetupRoute = pathname === "/setup" || pathname.startsWith("/setup/");

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isMenuOpen]);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    setIsLoggingOut(false);
    if (error) {
      // optional: toast or log
    } else {
      router.replace("/login");
    }
  }

  if (
    pathname === "/login" ||
    isSetupRoute ||
    pathname === "/verify-email" ||
    pathname === "/suspended" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  ) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined neon-text-primary text-primary-amber">
          sports_bar
        </span>
        <h1 className="text-sm font-bold uppercase tracking-tight text-white">
          HHU - Department of Alcohol
        </h1>
      </div>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen((open) => !open);
          }}
          className="group relative"
          aria-label="Account menu"
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
        >
          <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-primary-amber to-amber-600 opacity-40 blur transition duration-200 group-hover:opacity-75" />
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-surface-dark">
            <span className="material-symbols-outlined text-slate-400">
              account_circle
            </span>
          </div>
        </button>
        {isMenuOpen ? (
          <div className="absolute right-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-xl border border-white/10 bg-[#161b19] shadow-xl">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                router.push("/profile");
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
            >
              <span className="material-symbols-outlined text-[20px]">badge</span>
              View Profile
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                void handleLogout();
              }}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-2 border-t border-white/5 px-4 py-3 text-left text-sm font-medium text-rose-300 transition-colors hover:bg-white/5 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
