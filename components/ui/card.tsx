import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-violet-300/20 bg-zinc-950/80 backdrop-blur ${className}`}
      {...props}
    />
  );
}
