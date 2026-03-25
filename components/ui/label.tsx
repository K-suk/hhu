import type { LabelHTMLAttributes } from "react";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className = "", ...props }: LabelProps) {
  return (
    <label
      className={`text-xs font-semibold uppercase tracking-[0.16em] text-violet-200 ${className}`}
      {...props}
    />
  );
}
