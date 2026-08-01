import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`w-full rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-primary-amber/60 placeholder:text-zinc-500 focus:border-primary-amber/60 focus:ring-2 ${className}`}
      {...props}
    />
  );
}
