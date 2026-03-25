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
    "inline-flex w-full items-center justify-center rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const variantClassName =
    variant === "ghost"
      ? "border-violet-500/40 bg-transparent text-violet-200 hover:bg-violet-500/10"
      : "border-indigo-400 bg-indigo-500 text-white hover:bg-indigo-400";

  return (
    <button
      type={type}
      className={`${baseClassName} ${variantClassName} ${className}`}
      {...props}
    />
  );
}
