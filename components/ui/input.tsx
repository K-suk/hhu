import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`min-h-11 w-full rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-primary-amber/60 placeholder:text-zinc-500 focus:border-primary-amber/60 focus:ring-2 ${className}`}
      {...props}
    />
  );
}
