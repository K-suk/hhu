import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  const baseClassName =
    "inline-flex min-h-11 w-full items-center justify-center rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
  const variantClassName =
    variant === "ghost"
      ? "border-slate-600 bg-transparent text-slate-200 hover:bg-white/5"
      : "border-amber-700 bg-amber-400 text-stone-950 hover:bg-amber-300";

  return (
    <button
      type={type}
      className={`${baseClassName} ${variantClassName} ${className}`}
      {...props}
    />
  );
}
