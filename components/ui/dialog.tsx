"use client";

import type { HTMLAttributes, ReactNode } from "react";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-zinc-950/75 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-lg">{children}</div>
    </div>
  );
}

type DialogContentProps = HTMLAttributes<HTMLDivElement>;

export function DialogContent({ className = "", ...props }: DialogContentProps) {
  return (
    <div
      className={`rounded-xl border border-emerald-300/25 bg-zinc-900 p-5 shadow-[0_0_32px_rgba(16,185,129,0.2)] ${className}`}
      {...props}
    />
  );
}

type DialogHeaderProps = HTMLAttributes<HTMLDivElement>;

export function DialogHeader({ className = "", ...props }: DialogHeaderProps) {
  return <div className={`space-y-1 ${className}`} {...props} />;
}

type DialogTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function DialogTitle({ className = "", ...props }: DialogTitleProps) {
  return <h2 className={`text-xl font-semibold text-zinc-100 ${className}`} {...props} />;
}

type DialogDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function DialogDescription({
  className = "",
  ...props
}: DialogDescriptionProps) {
  return <p className={`text-sm text-zinc-400 ${className}`} {...props} />;
}
