"use client";

import { useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { MatchRevealModal } from "@/components/matching/match-reveal-modal";
import { MatchingOverlay } from "@/components/matching/matching-overlay";
import {
  COURSES,
  useMatchingSession,
} from "@/components/matching/use-matching-session";
import { useSessionRecovery } from "@/components/recovery/session-recovery-provider";
import { useToast } from "@/components/ui/toast-provider";
import type { Database } from "@/lib/supabase/database.types";

type MatchingHubProps = {
  userId: string;
  genderIdentity: Database["public"]["Tables"]["profiles"]["Row"]["gender_identity"];
  emailDomain: string;
  universityName: string | null;
  pendingCourseId?: string | null;
};


function ClinkMugs() {
  return (
    <svg
      className="h-24 w-24 drop-shadow-[0_0_10px_rgba(255,179,0,0.6)]"
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        className="animate-clink origin-[80px_150px]"
        style={{ transformOrigin: "80px 150px" }}
      >
        <path
          d="M40,60 h50 v80 a10,10 0 0 1 -10,10 h-30 a10,10 0 0 1 -10,-10 v-80 z"
          fill="none"
          stroke="#ffb300"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <path
          d="M90,80 h15 a10,10 0 0 1 10,10 v30 a10,10 0 0 1 -10,10 h-15"
          fill="none"
          stroke="#ffb300"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <rect x="45" y="70" width="40" height="70" fill="#ffca28" opacity="0.8" />
        <path
          d="M40,60 q10,-15 25,0 q10,-15 25,0"
          fill="white"
          stroke="white"
          strokeWidth="2"
        />
      </g>
      <g
        className="animate-clink-reverse origin-[120px_150px]"
        style={{ transformOrigin: "120px 150px" }}
      >
        <path
          d="M110,60 h50 v80 a10,10 0 0 1 -10,10 h-30 a10,10 0 0 1 -10,-10 v-80 z"
          fill="none"
          stroke="#ffb300"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <path
          d="M160,80 h15 a10,10 0 0 1 10,10 v30 a10,10 0 0 1 -10,10 h-15"
          fill="none"
          stroke="#ffb300"
          strokeLinecap="round"
          strokeWidth="6"
        />
        <rect x="115" y="70" width="40" height="70" fill="#ffca28" opacity="0.8" />
        <path
          d="M110,60 q10,-15 25,0 q10,-15 25,0"
          fill="white"
          stroke="white"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}

export function MatchingHub({
  userId,
  genderIdentity,
  emailDomain,
  universityName,
  pendingCourseId,
}: MatchingHubProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    initialProfileStatus,
    isInitialLoading,
    isSessionChecking,
    markStateRestored,
  } = useSessionRecovery();

  const onNavigate = useCallback((path: string) => router.push(path), [router]);
  const onUnauthorized = useCallback(() => router.push("/login"), [router]);
  const onToast = useCallback(
    (message: string, kind: "success" | "error" | "info") => showToast(message, kind),
    [showToast],
  );
  const {
    isSubmitting,
    isSearching,
    isCancelling,
    isEnteringBooth,
    activeCourse,
    errorMessage,
    revealState,
    markRecoveryCompleteOnce,
    enterBooth,
    enrolCourse,
    cancelSearch,
  } = useMatchingSession({
    userId,
    genderIdentity,
    emailDomain,
    pendingCourseId,
    initialProfileStatus,
    isInitialLoading,
    isSessionChecking,
    markStateRestored,
    onNavigate,
    onUnauthorized,
    onToast,
  });

  return (
    <>
      {revealState && activeCourse ? (
        <MatchRevealModal
          matchId={revealState.matchId}
          courseLabel={activeCourse.label}
          partner={revealState.partner}
          isEnteringBooth={isEnteringBooth}
          onEnterBooth={() => void enterBooth(revealState.matchId)}
        />
      ) : null}

      {isSearching && activeCourse && !revealState ? (
        <MatchingOverlay
          courseLabel={activeCourse.label}
          broadenedSearchLabel={universityName?.trim() || emailDomain}
          isCancelling={isCancelling}
          onCancel={cancelSearch}
          onReady={isInitialLoading ? markRecoveryCompleteOnce : undefined}
        />
      ) : null}

      <div className="flex min-h-screen flex-col bg-background-taproom font-display text-slate-100 antialiased selection:bg-primary-amber selection:text-black">
        <main className="relative flex flex-1 flex-col overflow-x-hidden pb-24">
          <div className="pointer-events-none absolute inset-0 bg-chalkboard opacity-20" />

          {/* Hero */}
          <section className="relative flex flex-col items-center justify-center gap-4 px-4 py-8 text-center">
            <div className="relative mb-2 h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-primary-amber/20 blur-3xl" />
              <ClinkMugs />
            </div>
            <div className="space-y-1">
              <h2 className="inline-block rounded-lg border-4 border-primary-amber/50 p-2 text-3xl font-bold uppercase tracking-widest text-white shadow-[0_0_15px_rgba(255,179,0,0.3),inset_0_0_10px_rgba(255,179,0,0.2)] neon-text-primary animate-flicker-taproom">
                Happy Hour
              </h2>
              <p className="mt-2 text-sm font-medium uppercase tracking-widest text-slate-400">
                Select a course to enter the matchmaking queue.
              </p>
            </div>

            {errorMessage ? (
              <div
                className="w-full max-w-sm rounded-md border border-rose-400/40 bg-rose-950/80 px-3 py-2 text-sm text-rose-100"
                role="alert"
              >
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-4 w-full max-w-sm overflow-hidden border-y border-primary-amber/20 bg-black/40 py-1 backdrop-blur-sm">
              <div className="flex items-center gap-8 whitespace-nowrap text-xs uppercase tracking-widest text-primary-amber/80 animate-[marquee_10s_linear_infinite]">
                <span>🍺 Pick a course and get paired in real time</span>
                <span>⚠️ One-on-one chat • Ephemeral matches</span>
                <span>🔔 UBC students only</span>
              </div>
            </div>
          </section>

          {/* On Tap */}
          <section className="mt-2 px-4">
            <div className="mb-4 flex items-center justify-between px-2">
              <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                <span className="material-symbols-outlined text-amber-glow">
                  menu_book
                </span>
                On Tap
              </h3>
              <span className="rounded-md border border-slate-700 px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                {COURSES.length} {COURSES.length === 1 ? "Course" : "Courses"}
              </span>
            </div>

            <div className="flex flex-col gap-5">
              {COURSES.map((course) => (
                <div
                  key={course.id}
                  className="group overflow-hidden rounded-xl border border-primary-amber/20 bg-stone-900/40 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] backdrop-blur-md transition-all duration-300 hover:border-primary-amber/50"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Visual / icon section */}
                    <div className="relative h-28 w-full shrink-0 sm:h-auto sm:w-1/3">
                      {course.imageUrl ? (
                        <>
                          <Image
                            src={course.imageUrl}
                            alt=""
                            fill
                            sizes="(min-width: 640px) 33vw, 100vw"
                            preload={course === COURSES[0]}
                            className="object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 to-transparent sm:bg-gradient-to-r" />
                        </>
                      ) : (
                        <>
                          <div
                            className="absolute inset-0 opacity-80 transition-transform duration-500 group-hover:scale-105"
                            style={{
                              background:
                                course.id === "beer-101"
                                  ? "linear-gradient(135deg, rgba(255,179,0,0.35) 0%, rgba(180,83,9,0.4) 100%)"
                                  : course.id === "wine-201"
                                    ? "linear-gradient(135deg, rgba(180,83,9,0.3) 0%, rgba(127,29,29,0.4) 100%)"
                                    : "linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(120,53,15,0.45) 100%)",
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 to-transparent sm:bg-gradient-to-r" />
                        </>
                      )}
                      <div className="absolute left-3 top-3 rounded-lg border border-primary-amber/20 bg-black/50 p-2 backdrop-blur">
                        <span
                          className="material-symbols-outlined animate-flicker-taproom text-primary-amber"
                          style={{ fontSize: 28 }}
                        >
                          {course.id === "beer-101"
                            ? "sports_bar"
                            : course.id === "wine-201"
                              ? "wine_bar"
                              : "liquor"}
                        </span>
                      </div>
                    </div>

                    {/* Content section */}
                    <div className="relative flex flex-1 flex-col justify-between p-5">
                      <div>
                        <div className="mb-2 flex items-start justify-between">
                          <h4 className="text-xl font-bold text-white">
                            {course.label}
                          </h4>
                          <span className="rounded border border-primary-amber/20 bg-primary-amber/10 px-2 py-1 font-mono text-xs font-medium text-primary-amber">
                            {course.abv} CREDITS
                          </span>
                        </div>
                        <p className="mb-4 text-sm text-slate-300">
                          {course.code}
                        </p>
                        <p className="text-xs text-slate-400">
                          Starts with this course, then expands across your university.
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-2">
                        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                          <span className="material-symbols-outlined text-[16px]">
                            monitoring
                          </span>
                          <span>Diff {course.ibu}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void enrolCourse(course)}
                          disabled={isSubmitting || isSearching || isInitialLoading}
                          className="group/btn flex items-center gap-1 rounded border border-primary-amber/50 bg-surface-dark py-2 px-5 font-mono text-sm font-bold text-primary-amber shadow-[0_0_10px_rgba(255,179,0,0.1)] transition-all hover:bg-primary-amber hover:text-black hover:shadow-[0_0_20px_rgba(255,179,0,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmitting ? "Joining..." : "Find a match"}
                          {!isSubmitting && (
                            <span className="material-symbols-outlined text-[18px] transition-transform group-hover/btn:translate-x-1">
                              arrow_forward
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <div className="h-8" />
        </main>
      </div>
    </>
  );
}
