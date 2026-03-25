"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ToastTone = "error" | "success" | "info";

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  dismissToast: (id: string) => void;
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev, { id, message, tone }].slice(-3));
  }, []);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), 3200),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismissToast, toasts]);

  const value = useMemo(
    () => ({
      dismissToast,
      showToast,
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 left-1/2 z-[120] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-2 md:max-w-xl">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-[0_0_20px_rgba(0,0,0,0.22)] ${
              toast.tone === "success"
                ? "border-emerald-300/40 bg-emerald-950/95 text-emerald-100"
                : toast.tone === "error"
                  ? "border-rose-300/40 bg-rose-950/95 text-rose-100"
                  : "border-amber-300/40 bg-stone-950/95 text-amber-100"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
