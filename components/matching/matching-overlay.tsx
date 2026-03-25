"use client";

import { useEffect, useMemo, useState } from "react";

type MatchingOverlayProps = {
  courseLabel: string;
  broadenedSearchLabel: string;
  isCancelling: boolean;
  onCancel: () => void;
  onReady?: () => void;
};

const TERMINAL_LINES = [
  "> Drink water between drinks to stay hydrated.",
  "> Know your limits and stick to them.",
  "> Eat before and while you drink to slow absorption.",
  "> Never drink and drive. Use transit, a cab, or a designated driver.",
  "> Pace yourself — one drink per hour is a safe guideline.",
  "> Look out for friends. If someone's had too much, help them get home safe.",
  "> Set a plan before you go. How will you get home?",
  "> If you choose to drink, keep it moderate. Your future self will thank you.",
];

export function MatchingOverlay({
  courseLabel,
  broadenedSearchLabel,
  isCancelling,
  onCancel,
  onReady,
}: MatchingOverlayProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [isBroadenedSearch, setIsBroadenedSearch] = useState(false);

  useEffect(() => {
    if (!onReady) return;

    let frameIdA = 0;
    let frameIdB = 0;
    frameIdA = window.requestAnimationFrame(() => {
      frameIdB = window.requestAnimationFrame(() => {
        onReady();
      });
    });

    return () => {
      window.cancelAnimationFrame(frameIdA);
      window.cancelAnimationFrame(frameIdB);
    };
  }, [onReady]);

  const shuffled = useMemo(() => {
    const copy = [...TERMINAL_LINES];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, []);

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < shuffled.length) {
        setVisibleLines((prev) => [...prev, shuffled[idx]]);
        idx++;
      } else {
        idx = 0;
        setVisibleLines([]);
      }
    }, 2200);
    return () => clearInterval(interval);
  }, [shuffled]);

  useEffect(() => {
    setIsBroadenedSearch(false);
    const timeoutId = window.setTimeout(() => {
      setIsBroadenedSearch(true);
    }, 30_000);

    return () => window.clearTimeout(timeoutId);
  }, [courseLabel]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-stone-950 font-display text-slate-100 antialiased">
      {/* Ambient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-stone-950" />
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
        {/* Ambient amber/emerald light leaks */}
        <div className="pointer-events-none absolute top-0 left-1/2 h-60 w-96 -translate-x-1/2 rounded-full bg-primary-amber/8 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-20 left-10 h-40 w-40 rounded-full bg-emerald-500/5 blur-[80px]" />
        {/* Rising bubbles */}
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <span className="absolute bottom-0 left-[8%] size-2 rounded-full bg-amber-200/60 [animation:rise_4s_ease-in_infinite]" />
          <span className="absolute bottom-0 left-[22%] size-3 rounded-full bg-amber-200/50 [animation:rise_5s_ease-in_infinite_1.2s]" />
          <span className="absolute bottom-0 left-[40%] size-1.5 rounded-full bg-amber-200/60 [animation:rise_3.5s_ease-in_infinite_0.6s]" />
          <span className="absolute bottom-0 left-[58%] size-2 rounded-full bg-amber-200/50 [animation:rise_4.5s_ease-in_infinite_2s]" />
          <span className="absolute bottom-0 left-[75%] size-1 rounded-full bg-amber-200/70 [animation:rise_3s_ease-in_infinite_0.3s]" />
          <span className="absolute bottom-0 left-[90%] size-2.5 rounded-full bg-amber-200/40 [animation:rise_6s_ease-in_infinite_3s]" />
        </div>
      </div>

      {/* Content container */}
      <div className="relative z-10 mx-auto flex h-full w-full max-w-md flex-col md:max-w-2xl">
        {/* Header bar */}
        <header className="flex items-center justify-between border-b border-white/5 bg-stone-950/80 px-4 py-4 backdrop-blur-md">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className="flex items-center justify-center rounded-full p-2 text-white transition-colors hover:bg-white/5 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Back"
          >
            <span className="material-symbols-outlined !text-2xl">arrow_back</span>
          </button>
          <h1 className="font-mono text-sm tracking-widest text-white/80 uppercase">
            HHU SERVER: <span className="text-red-500 animate-pulse">CRITICAL</span>
          </h1>
          <div className="w-10" />
        </header>

        {/* Main content */}
        <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-6">
          {/* Headline */}
          <div className="w-full space-y-2 text-center">
            <h2 className="font-mono text-lg leading-relaxed font-bold text-amber-300 uppercase [text-shadow:0_0_5px_rgba(251,191,36,0.3),0_0_15px_rgba(251,191,36,0.2),0_0_30px_rgba(251,191,36,0.15)] [animation:queue_flicker_3s_linear_infinite] md:text-xl">
              Server is hungover.
              <br />
              Please stand by.
            </h2>
            <p className="font-mono text-xs tracking-widest text-stone-500 uppercase">
              [ ERR_ALCOHOL_LEVEL_CRITICAL ]
            </p>
            <p className="font-mono text-[11px] tracking-wider text-primary-amber/70 uppercase">
              Course: {courseLabel}
            </p>
            {isBroadenedSearch ? (
              <p className="font-mono text-[11px] tracking-wider text-emerald-400/80 uppercase">
                {`> BROADENING SEARCH: Looking for any students at ${broadenedSearchLabel}...`}
              </p>
            ) : null}
          </div>

          {/* Animated Beer Glass SVG */}
          <div className="relative h-44 w-28">
            <svg
              className="absolute inset-0 h-full w-full drop-shadow-[0_0_20px_rgba(251,191,36,0.25)]"
              viewBox="0 0 100 160"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <clipPath id="glassClip">
                  <path d="M18,8 L82,8 L78,140 C78,148 73,152 50,152 C27,152 22,148 22,140 Z" />
                </clipPath>
                <linearGradient id="beerGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#b45309" stopOpacity="1" />
                </linearGradient>
              </defs>

              {/* Glass body */}
              <path
                d="M18,8 L82,8 L78,140 C78,148 73,152 50,152 C27,152 22,148 22,140 Z"
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="2"
              />

              {/* Beer liquid - animated fill from bottom */}
              <g clipPath="url(#glassClip)">
                <rect className="beer-fill-anim" x="0" y="152" width="100" height="145" fill="url(#beerGradient)" />
                {/* Internal bubbles */}
                <circle cx="35" cy="120" r="1.2" fill="rgba(255,255,255,0.35)">
                  <animate attributeName="cy" from="145" to="30" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="2.2s" repeatCount="indefinite" />
                </circle>
                <circle cx="55" cy="100" r="1" fill="rgba(255,255,255,0.3)">
                  <animate attributeName="cy" from="140" to="25" dur="2.8s" begin="0.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="2.8s" begin="0.4s" repeatCount="indefinite" />
                </circle>
                <circle cx="45" cy="130" r="0.8" fill="rgba(255,255,255,0.3)">
                  <animate attributeName="cy" from="148" to="20" dur="3.2s" begin="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="3.2s" begin="1s" repeatCount="indefinite" />
                </circle>
                <circle cx="65" cy="110" r="1.4" fill="rgba(255,255,255,0.25)">
                  <animate attributeName="cy" from="150" to="35" dur="2.5s" begin="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="2.5s" begin="1.8s" repeatCount="indefinite" />
                </circle>
              </g>

              {/* Foam head */}
              <g clipPath="url(#glassClip)">
                <ellipse className="foam-anim" cx="50" cy="12" rx="35" ry="0" fill="white" opacity="0.9" />
                <ellipse className="foam-anim-2" cx="38" cy="14" rx="20" ry="0" fill="white" opacity="0.7" />
                <ellipse className="foam-anim-3" cx="62" cy="14" rx="20" ry="0" fill="white" opacity="0.7" />
              </g>

              {/* Glass reflections */}
              <path d="M24,12 L27,135" fill="none" opacity="0.2" stroke="white" strokeLinecap="round" strokeWidth="1.5" />
              <path d="M76,12 L73,50" fill="none" opacity="0.15" stroke="white" strokeLinecap="round" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Terminal log */}
          <div className="relative w-full max-w-sm overflow-hidden rounded-lg border border-emerald-500/20 bg-black/40 shadow-[0_0_25px_rgba(16,185,129,0.08)] backdrop-blur-lg">
            <div className="flex items-center gap-2 border-b border-emerald-500/10 px-3 py-2">
              <div className="size-2 rounded-full bg-emerald-500/60" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-500/50">
                hhu-terminal v2.0
              </span>
            </div>
            {/* CRT scanlines */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,0.08)_50%,rgba(0,0,0,0.08))] bg-[length:100%_4px]" />
            <div className="h-28 space-y-2.5 overflow-hidden p-3 font-mono text-xs">
              {visibleLines.map((line, idx) => (
                <p
                  key={`${line}-${idx}`}
                  className="animate-[fadeIn_0.3s_ease-out] text-emerald-400/90 [text-shadow:0_0_5px_rgba(16,185,129,0.15)]"
                >
                  {line}
                </p>
              ))}
              <span className="inline-block h-3.5 w-1.5 animate-pulse bg-emerald-400/80" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isCancelling}
              className="group relative flex min-w-[200px] items-center justify-center overflow-hidden rounded-md px-10 py-4 transition-all disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="absolute inset-0 h-full w-full rounded-md border border-red-500/30 bg-red-950/30 transition-all group-hover:bg-red-900/40" />
              <div className="absolute inset-0 h-full w-full rounded-md shadow-[0_0_15px_rgba(220,38,38,0.15)] transition-all group-hover:shadow-[0_0_25px_rgba(220,38,38,0.3)]" />
              <span className="relative flex shrink-0 items-center justify-center gap-3 whitespace-nowrap font-mono text-sm tracking-wider text-red-400 uppercase group-hover:text-red-300">
                <span className="material-symbols-outlined text-xl">liquor</span>
                {isCancelling ? "Spilling..." : "Spill the Beer"}
              </span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
