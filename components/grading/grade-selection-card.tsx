"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast-provider";
import { handleProtectedResponse } from "@/lib/client/security-ui";
import { CSRF_HEADER_NAME } from "@/lib/security/csrf-shared";
import { getCsrfToken } from "@/lib/security/csrf-client";
import { submitGradeSchema } from "@/lib/validations/matching";

type GradeSelectionCardProps = {
  matchId: string;
  courseLabel: string;
  ratedUserId: string;
  userId: string;
};

type GradeOption = {
  letter: "A+" | "A" | "B" | "C" | "F";
  point: number;
};

const GRADE_OPTIONS: GradeOption[] = [
  { letter: "A+", point: 4.33 },
  { letter: "A", point: 4.0 },
  { letter: "B", point: 3.0 },
  { letter: "C", point: 2.0 },
  { letter: "F", point: 0.0 },
];

export function GradeSelectionCard({
  matchId,
  courseLabel,
  ratedUserId,
  userId: _userId,
}: GradeSelectionCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedGrade, setSelectedGrade] = useState<GradeOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successToast, setSuccessToast] = useState(false);

  const gpaImpact = useMemo(() => {
    if (!selectedGrade) {
      return "+0.00";
    }

    const diff = selectedGrade.point - 3.0;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${diff.toFixed(2)}`;
  }, [selectedGrade]);

  async function handleSubmit() {
    if (!selectedGrade || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const parsed = submitGradeSchema.safeParse({
      p_match_id: matchId,
      p_rated_user_id: ratedUserId,
      p_grade_point: selectedGrade.point,
    });

    if (!parsed.success) {
      setIsSubmitting(false);
      setErrorMessage("Invalid grading input.");
      return;
    }

    const csrfToken = await getCsrfToken();
    const response = await fetch("/api/ratings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: csrfToken,
      },
      body: JSON.stringify(parsed.data),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const error = await handleProtectedResponse(response, () => router.push("/login"));
      setErrorMessage(error ?? "Failed to submit grade.");
      return;
    }

    setSuccessToast(true);
    showToast("Grade submitted.", "success");
    setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 900);
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a110e] font-display text-slate-100">
      <div className="pointer-events-none fixed top-[-20%] left-[-10%] h-[50%] w-[50%] rounded-full bg-emerald-300/10 blur-[120px]" />
      <div className="pointer-events-none fixed right-[-10%] bottom-[-10%] h-[60%] w-[60%] rounded-full bg-emerald-300/5 blur-[100px]" />
      <div className="pointer-events-none fixed inset-0 z-10 opacity-15 [background-image:linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,0)_50%,rgba(0,0,0,0.2)_50%,rgba(0,0,0,0.2)_100%)] [background-size:100%_4px]" />

      {successToast ? (
        <div className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-emerald-300/40 bg-emerald-950/95 px-3 py-2 text-sm text-emerald-100 md:max-w-xl">
          Grade Submitted
        </div>
      ) : null}

      <main className="relative z-20 flex flex-1 flex-col items-center overflow-y-auto px-4 pt-2 pb-28 md:px-8">
        <div className="relative w-full max-w-md md:max-w-2xl">
          <div className="relative bg-[#f0f2f1] px-5 pt-6 pb-8 text-slate-800 shadow-2xl shadow-black/50">
            <div className="mb-4 flex flex-col items-center border-b-2 border-dashed border-slate-300 pb-4">
              <div className="mb-3 h-16 w-16 overflow-hidden rounded-full border-2 border-slate-300 bg-slate-200">
                <div className="h-full w-full bg-[radial-gradient(circle_at_30%_30%,#a3a3a3,#6b7280)] opacity-80" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight uppercase">
                Official Transcript
              </h2>
              <p className="mt-1 font-mono text-xs tracking-widest text-slate-500 uppercase">
                Receipt #{matchId.slice(0, 8).toUpperCase()}
              </p>
            </div>

            <div className="mb-6 space-y-3 font-mono text-sm">
              <div className="flex justify-between border-b border-dashed border-slate-300 pb-2">
                <span className="text-slate-500 uppercase">Student</span>
                <span className="font-bold">Assigned Partner</span>
              </div>
              <div className="flex items-end justify-between pt-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-600 uppercase">
                    {courseLabel}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">
                    Interaction Evaluation
                  </span>
                </div>
                <span className="font-bold">{selectedGrade?.letter ?? "-"}</span>
              </div>
              <div className="mt-2 flex items-end justify-between border-t border-dashed border-slate-300 pt-2">
                <span className="text-xs text-slate-500 uppercase">Term GPA</span>
                <span className="font-bold">3.67</span>
              </div>
            </div>

            <div className="border-t-2 border-dashed border-slate-300 py-6">
              <p className="mb-6 text-center text-sm font-bold tracking-wider uppercase">
                Interaction Assessment
              </p>
              <div className="mb-6 grid grid-cols-3 place-items-center gap-x-4 gap-y-6">
                {GRADE_OPTIONS.map((option) => {
                  const active = selectedGrade?.letter === option.letter;
                  return (
                    <button
                      key={option.letter}
                      type="button"
                      onClick={() => setSelectedGrade(option)}
                      className={`group relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-slate-100 transition-all duration-200 focus:outline-none active:scale-95 ${active
                        ? "border-amber-400 bg-amber-400/10 shadow-[0_0_15px_rgba(255,191,0,0.7),0_0_30px_rgba(255,191,0,0.3)]"
                        : "border-slate-300 hover:border-amber-400 hover:shadow-[0_0_10px_rgba(255,191,0,0.5),0_0_20px_rgba(255,191,0,0.3)]"
                        }`}
                    >
                      <div className="absolute inset-1 rounded-full border border-slate-200 group-hover:border-amber-400/30" />
                      <span
                        className={`text-xl font-bold ${active
                          ? "text-amber-500"
                          : "text-slate-400 group-hover:text-amber-500"
                          }`}
                      >
                        {option.letter}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t-2 border-dashed border-slate-300 pt-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-lg font-bold uppercase">GPA Impact</span>
                <span className="font-mono text-xl font-bold text-amber-700">
                  {gpaImpact}
                </span>
              </div>
              <div className="my-4 h-12 w-full opacity-60">
                <div className="flex h-full w-full justify-between px-8">
                  <div className="h-full w-1 bg-slate-800" />
                  <div className="h-full w-2 bg-slate-800" />
                  <div className="h-full w-px bg-slate-800" />
                  <div className="h-full w-3 bg-slate-800" />
                  <div className="h-full w-px bg-slate-800" />
                  <div className="h-full w-1 bg-slate-800" />
                  <div className="h-full w-4 bg-slate-800" />
                  <div className="h-full w-1 bg-slate-800" />
                  <div className="h-full w-px bg-slate-800" />
                  <div className="h-full w-2 bg-slate-800" />
                  <div className="h-full w-1 bg-slate-800" />
                  <div className="h-full w-3 bg-slate-800" />
                </div>
              </div>
              <p className="text-center font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                Thank you for socializing responsibly
              </p>
            </div>

            {errorMessage ? (
              <p className="mt-4 rounded-lg border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {errorMessage}
              </p>
            ) : null}

            <div className="pointer-events-none absolute right-0 bottom-[-16px] left-0 h-4 translate-y-[99%] [background:linear-gradient(-45deg,transparent_8px,#f0f2f1_0)_0_100%,linear-gradient(45deg,transparent_8px,#f0f2f1_0)_0_100%] [background-size:16px_16px] [background-repeat:repeat-x]" />
          </div>

          <div className="absolute bottom-[-20px] left-1/2 z-20 -translate-x-1/2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedGrade || isSubmitting}
              className="group relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#13201a] bg-[#13201a] shadow-xl transition-transform duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="absolute inset-0 rounded-full bg-amber-400/20 opacity-20 group-hover:opacity-40 animate-pulse" />
              <div className="relative z-10 flex h-full w-full items-center justify-center rounded-full border-2 border-amber-700 bg-amber-400 text-[#13201a]">
                <span className="material-symbols-outlined text-[32px] font-bold">
                  verified
                </span>
              </div>
            </button>
          </div>
        </div>
      </main>
    </main>
  );
}
