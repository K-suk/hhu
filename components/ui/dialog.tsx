"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  dismissible?: boolean;
};

type DialogContextValue = {
  contentRef: React.RefObject<HTMLDivElement | null>;
  descriptionId: string;
  titleId: string;
};

const DialogContext = createContext<DialogContextValue | null>(null);
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onOpenChange,
  children,
  dismissible = true,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frameId = window.requestAnimationFrame(() => {
      const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
        FOCUSABLE_SELECTOR,
      );
      (firstFocusable ?? contentRef.current)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab" || !contentRef.current) {
        return;
      }

      const focusableElements = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hidden);

      if (focusableElements.length === 0) {
        event.preventDefault();
        contentRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [dismissible, onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <DialogContext.Provider value={{ contentRef, descriptionId, titleId }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        {dismissible ? (
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-zinc-950/75 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-950/75 backdrop-blur-sm" />
        )}
        <div className="relative z-10 w-full max-w-lg">{children}</div>
      </div>
    </DialogContext.Provider>
  );
}

type DialogContentProps = HTMLAttributes<HTMLDivElement>;

export function DialogContent({ className = "", ...props }: DialogContentProps) {
  const context = useContext(DialogContext);

  return (
    <div
      ref={context?.contentRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={context?.titleId}
      aria-describedby={context?.descriptionId}
      tabIndex={-1}
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
  const context = useContext(DialogContext);

  return (
    <h2
      id={context?.titleId}
      className={`text-xl font-semibold text-zinc-100 ${className}`}
      {...props}
    />
  );
}

type DialogDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function DialogDescription({
  className = "",
  ...props
}: DialogDescriptionProps) {
  const context = useContext(DialogContext);

  return (
    <p
      id={context?.descriptionId}
      className={`text-sm text-zinc-400 ${className}`}
      {...props}
    />
  );
}
