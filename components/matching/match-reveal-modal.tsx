"use client";

import { useMemo } from "react";

import { CyberIdCard, type CyberIdProfile } from "@/components/profile/cyber-id-card";

type MatchRevealModalProps = {
  matchId: string;
  courseLabel: string;
  partner: CyberIdProfile;
  isEnteringBooth?: boolean;
  onEnterBooth: () => void;
};

const ACADEMIC_NOTES = [
  "Specialization: Tactical Inebriation",
  "Prerequisite Met: Student ID verified & Beer glass filled.",
  "Note: May discuss Kafka after two pints.",
  "Warning: Knows every ramen spot within 2km of campus.",
  "Research Interest: Optimal Pub-to-Library Migration Patterns",
  "Office Hours: Only available after happy hour.",
  "Thesis: 'On the Correlation Between GPA and Alcohol Intake'",
];

export function MatchRevealModal({
  courseLabel,
  partner,
  isEnteringBooth = false,
  onEnterBooth,
}: MatchRevealModalProps) {
  const academicNote = useMemo(
    () => ACADEMIC_NOTES[Math.floor(Math.random() * ACADEMIC_NOTES.length)],
    [],
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden font-display antialiased">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

      {/* Modal card */}
      <div className="relative z-10 mx-4 w-full max-w-sm animate-[fadeScaleIn_0.5s_ease-out_both] rounded-3xl border-2 border-emerald-400/30 bg-stone-900/80 shadow-[0_0_80px_rgba(16,185,129,0.12),0_0_160px_rgba(16,185,129,0.06)] backdrop-blur-xl">
        {/* Holographic sheen */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(16,185,129,0.08)_45%,rgba(16,185,129,0.14)_50%,rgba(16,185,129,0.08)_55%,transparent_75%)] bg-[length:220%_100%] animate-[shimmer_4s_linear_infinite]" />

        <div className="relative z-10 p-5">
          {/* Header - Glitchy banner */}
          <div className="mb-4 text-center">
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-400/60">
              // System Notification
            </p>
            <h2 className="glitch-text font-mono text-lg font-bold uppercase tracking-[0.15em] text-emerald-300 [text-shadow:0_0_8px_rgba(16,185,129,0.4),0_0_20px_rgba(16,185,129,0.2)] md:text-xl">
              Seminar Partner Assigned
            </h2>
            <div className="mx-auto mt-2 h-px w-3/4 bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
            <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-primary-amber/70">
              Course: {courseLabel}
            </p>
          </div>

          {/* Partner's Cyber Student ID */}
          <div className="relative mx-auto">
            {/* Scan line overlay */}
            <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl">
              <div className="scan-line absolute left-0 h-0.5 w-full bg-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.4),0_-4px_8px_rgba(16,185,129,0.2)]" />
            </div>
            <CyberIdCard profile={partner} />
          </div>

          {/* Academic Note */}
          <div className="mb-4 rounded-lg border border-white/5 bg-black/30 px-4 py-3">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined mt-0.5 text-sm text-emerald-400/60">
                description
              </span>
              <p className="font-mono text-xs leading-relaxed text-emerald-400/70">
                &quot;{academicNote}&quot;
              </p>
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={onEnterBooth}
            disabled={isEnteringBooth}
            className="group/btn relative w-full overflow-hidden rounded-full bg-primary-amber p-[1px]"
          >
            <div className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-1000 group-hover/btn:translate-x-[100%]" />
            <div className="relative flex h-14 w-full items-center justify-center rounded-full border border-primary-amber/50 bg-stone-950/90 transition-all group-hover/btn:bg-primary-amber">
              <span className="mr-2 font-mono text-sm font-bold uppercase tracking-widest text-primary-amber group-hover/btn:text-black">
                {isEnteringBooth ? "Entering..." : "Enter the Booth"}
              </span>
              <span className="material-symbols-outlined text-primary-amber transition-transform group-hover/btn:translate-x-1 group-hover/btn:text-black">
                arrow_forward
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
