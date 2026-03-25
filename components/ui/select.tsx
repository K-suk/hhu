import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", ...props }: SelectProps) {
  return (
    <select
      className={`w-full rounded-md border border-violet-300/30 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-indigo-500/60 focus:ring-2 ${className}`}
      {...props}
    />
  );
}
