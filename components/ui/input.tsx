import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-md border border-violet-300/30 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-indigo-500/60 placeholder:text-zinc-500 focus:ring-2 ${className}`}
      {...props}
    />
  );
}
