"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast-provider";
import { createClient } from "@/lib/supabase/client";

export function TaproomHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const isSetupRoute = pathname === "/setup" || pathname.startsWith("/setup/");

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    if (isMenuOpen) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        showToast("We couldn't log you out. Check your connection and try again.", "error");
        return;
      }

      router.replace("/login");
    } catch {
      showToast("We couldn't log you out. Check your connection and try again.", "error");
    } finally {
      setIsLoggingOut(false);
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
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-black/95 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined neon-text-primary text-primary-amber"
          aria-hidden="true"
        >
          sports_bar
        </span>
        <h1 className="text-sm font-bold uppercase tracking-tight text-white">
          HHU - Department of Alcohol
        </h1>
      </div>
      <div className="relative" ref={menuRef}>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen((open) => !open);
          }}
          className="group relative flex h-11 w-11 items-center justify-center rounded-full"
          aria-label="Account menu"
          aria-expanded={isMenuOpen}
          aria-controls="account-menu"
        >
          <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-primary-amber to-amber-600 opacity-40 blur transition duration-200 group-hover:opacity-75" />
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-surface-dark">
            <span className="material-symbols-outlined text-slate-400" aria-hidden="true">
              account_circle
            </span>
          </div>
        </button>
        {isMenuOpen ? (
          <div
            id="account-menu"
            className="absolute right-0 top-full z-50 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-[#161b19] shadow-xl"
          >
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                router.push("/profile");
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                badge
              </span>
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
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                logout
              </span>
              {isLoggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
