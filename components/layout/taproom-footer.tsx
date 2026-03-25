"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Taproom",
    icon: "sports_bar",
    match: (p) => p === "/",
  },
  {
    href: "/profile",
    label: "ID",
    icon: "badge",
    match: (p) => p === "/profile" || p === "/setup" || p.startsWith("/setup/"),
  },
];

export function TaproomFooter() {
  const pathname = usePathname();
  const isSetupRoute = pathname === "/setup" || pathname.startsWith("/setup/");

  if (
    pathname === "/login" ||
    isSetupRoute ||
    pathname === "/verify-email" ||
    pathname === "/waitlist" ||
    pathname === "/suspended" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  ) {
    return null;
  }

  return (
    <nav className="taproom-footer fixed bottom-0 left-0 z-50 w-full border-t border-[#283932] bg-[#1b2722]/90 px-2 pb-4 pt-2 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg items-center justify-between">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-1 flex-col items-center justify-end gap-1"
              aria-label={item.label}
            >
              <div className="relative flex items-center justify-center p-1 transition-transform group-hover:-translate-y-1">
                {active ? (
                  <div className="absolute inset-0 rounded-full bg-primary-amber/20 blur-md" />
                ) : null}
                <span
                  className={`material-symbols-outlined relative z-10 text-[28px] transition-colors ${
                    active
                      ? "neon-text-primary text-primary-amber"
                      : "text-[#9cbaad] group-hover:text-white"
                  }`}
                >
                  {item.icon}
                </span>
              </div>
              <p
                className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  active
                    ? "neon-text-primary text-primary-amber"
                    : "text-[#9cbaad] group-hover:text-white"
                }`}
              >
                {item.label}
              </p>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
