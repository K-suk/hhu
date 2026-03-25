"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const RECOVERY_LOGS = [
  "> Reload detected. Restoring beer server state...",
  "> Bypassing UBC VPN (not really)...",
  "> Checking your previous drinking session...",
  "> Waiting for the server to hydrate and calm down...",
] as const;

const TYPING_SPEED_MS = 34;
const HOLD_AFTER_LINE_MS = 950;

function PixelBeerMug() {
  return (
    <svg
      aria-hidden="true"
      className="h-24 w-24 sm:h-28 sm:w-28"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="12" y="14" width="30" height="36" rx="3" fill="#ffd166" opacity="0.15" />
      <rect x="15" y="17" width="24" height="30" fill="#ffb703" opacity="0.26" />
      <rect x="17" y="22" width="20" height="23" fill="#ffb703" opacity="0.66" />
      <rect x="42" y="22" width="8" height="18" rx="2" fill="none" stroke="#ffd166" strokeWidth="3" />
      <rect x="15" y="12" width="8" height="5" fill="#fff2cc" />
      <rect x="23" y="10" width="8" height="7" fill="#fff2cc" />
      <rect x="31" y="12" width="8" height="5" fill="#fff2cc" />
      <rect x="13" y="14" width="28" height="2" fill="#ffdf8b" opacity="0.75" />
      <rect x="16" y="50" width="22" height="2" fill="#ffb703" opacity="0.65" />
    </svg>
  );
}

export function RecoveryScreen() {
  const [lineIndex, setLineIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);

  const activeLine = RECOVERY_LOGS[lineIndex];
  const displayed = activeLine.slice(0, typedChars);

  useEffect(() => {
    if (typedChars < activeLine.length) {
      const typeTimer = window.setTimeout(() => {
        setTypedChars((prev) => prev + 1);
      }, TYPING_SPEED_MS);

      return () => window.clearTimeout(typeTimer);
    }

    const holdTimer = window.setTimeout(() => {
      setTypedChars(0);
      setLineIndex((prev) => (prev + 1) % RECOVERY_LOGS.length);
    }, HOLD_AFTER_LINE_MS);

    return () => window.clearTimeout(holdTimer);
  }, [activeLine, typedChars]);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[220] flex min-h-screen items-center justify-center overflow-hidden bg-stone-950"
      exit={{ opacity: 0 }}
      initial={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.14)_0%,rgba(0,0,0,0)_48%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_36%,rgba(24,24,27,0.82)_100%)]" />
      <div className="recovery-scanline pointer-events-none absolute inset-0" />
      <div className="recovery-crt-flicker pointer-events-none absolute inset-0" />

      <div className="relative mx-4 w-full max-w-md rounded-xl border border-amber-200/25 bg-stone-950/70 p-6 shadow-[0_0_32px_rgba(245,158,11,0.3)] backdrop-blur-sm">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(245,158,11,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,158,11,0.08)_1px,transparent_1px)] bg-[size:20px_20px] opacity-70" />

        <div className="flex flex-col items-center gap-4 text-center">
          <motion.div
            animate={{ opacity: [0.45, 1, 0.55], scale: [0.97, 1.03, 0.99] }}
            className="rounded-lg border border-amber-300/40 bg-black/40 p-4 shadow-[0_0_25px_rgba(245,158,11,0.45)]"
            transition={{ duration: 2.1, ease: "easeInOut", repeat: Infinity }}
          >
            <PixelBeerMug />
          </motion.div>

          <motion.h1
            animate={{ opacity: [0.75, 1, 0.7] }}
            className="text-lg font-semibold tracking-[0.28em] text-amber-200 sm:text-xl"
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          >
            HHU RECOVERY
          </motion.h1>

          <div className="w-full rounded-md border border-amber-200/25 bg-black/50 p-3 text-left font-mono text-xs leading-6 text-amber-100 sm:text-sm">
            <motion.p
              key={lineIndex}
              animate={{ opacity: [0.7, 1] }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {displayed}
              <span className="ml-0.5 inline-block h-4 w-[1px] animate-pulse bg-amber-200 align-middle" />
            </motion.p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
