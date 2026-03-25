"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { MatchRevealModal } from "@/components/matching/match-reveal-modal";
import { MatchingOverlay } from "@/components/matching/matching-overlay";
import { useSessionRecovery } from "@/components/recovery/session-recovery-provider";
import { useToast } from "@/components/ui/toast-provider";
import {
  getFriendlyErrorMessage,
  handleProtectedResponse,
} from "@/lib/client/security-ui";
import { createClient } from "@/lib/supabase/client";
import { CSRF_HEADER_NAME } from "@/lib/security/csrf-shared";
import { getCsrfToken } from "@/lib/security/csrf-client";
import type { Database } from "@/lib/supabase/database.types";
import { enrolCourseSchema } from "@/lib/validations/matching";

type Course = {
  id: string;
  label: string;
  code: string;
  badge: "Core" | "Elec" | "Lab";
  abv: string;
  ibu: string;
  /** Optional image URL for the course card. When set, shown in the left panel; otherwise a gradient is used. */
  imageUrl?: string | null;
};

type MatchingHubProps = {
  userId: string;
  genderIdentity: Database["public"]["Tables"]["profiles"]["Row"]["gender_identity"];
  emailDomain: string;
  universityName: string | null;
  pendingCourseId?: string | null;
};

const COURSES: Course[] = [
  {
    id: "beer-101",
    label: "BEER 101",
    code: "From keg to glass: applied thermodynamics and friendship formation.",
    badge: "Core",
    abv: "5.0%",
    ibu: "25",
    imageUrl: "/images/beer101.jpg",
  },
  // {
  //   id: "wine-201",
  //   label: "WINE 201",
  //   code: "Sommelier tactics. Tannins, terroir, and talking slightly pretentious.",
  //   badge: "Elec",
  //   abv: "12.5%",
  //   ibu: "10",
  //   imageUrl: "/images/wine201.jpg",
  // },
  // {
  //   id: "tequila-301",
  //   label: "TEQUILA 911",
  //   code: "Advanced Shots & Mixology. For people who wanna fxxed up.",
  //   badge: "Lab",
  //   abv: "38.0%",
  //   ibu: "95",
  //   imageUrl: "/images/teq911.jpg",
  // },
];

type EnrolCourseResponse =
  | string
  | null
  | { match_id: string | null }
  | { match_id?: string | null }[];

function extractMatchId(response: EnrolCourseResponse): string | null {
  if (!response) return null;
  if (typeof response === "string") return response;
  if (Array.isArray(response)) return response[0]?.match_id ?? null;
  return response.match_id ?? null;
}

function getCourseById(courseId: string | null | undefined): Course | null {
  if (!courseId) return null;
  const knownCourse = COURSES.find((course) => course.id === courseId);
  if (knownCourse) return knownCourse;

  return {
    id: courseId,
    label: courseId.toUpperCase(),
    code: "Recovered from active queue session.",
    badge: "Core",
    abv: "--",
    ibu: "--",
    imageUrl: null,
  };
}

function getRecoveredWaitingCourse(fallbackCourse: Course | null): Course {
  if (fallbackCourse) return fallbackCourse;

  return {
    id: "queue-recovery",
    label: "QUEUE SYNC",
    code: "Recovered waiting state from profile status.",
    badge: "Core",
    abv: "--",
    ibu: "--",
    imageUrl: null,
  };
}

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

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PartnerPreview = Pick<ProfileRow, "display_name" | "avatar_url" | "department">;

type RevealState = {
  matchId: string;
  partner: PartnerPreview;
};

const MATCH_ENTRY_RETRY_DELAYS_MS = [0, 200, 400, 800, 1200] as const;

export function MatchingHub({
  userId,
  genderIdentity,
  emailDomain,
  universityName,
  pendingCourseId,
}: MatchingHubProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const {
    initialProfileStatus,
    isInitialLoading,
    isSessionChecking,
    markStateRestored,
  } = useSessionRecovery();

  const restoredCourse = useMemo(
    () => getCourseById(pendingCourseId),
    [pendingCourseId],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(!!restoredCourse);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isEnteringBooth, setIsEnteringBooth] = useState(false);
  const [activeCourse, setActiveCourse] = useState<Course | null>(restoredCourse);
  const [errorMessage, setErrorMessage] = useState("");
  const [revealState, setRevealState] = useState<RevealState | null>(null);
  const hasMarkedRecoveryCompleteRef = useRef(false);

  const markRecoveryCompleteOnce = useCallback(() => {
    if (hasMarkedRecoveryCompleteRef.current) return;
    hasMarkedRecoveryCompleteRef.current = true;
    markStateRestored();
  }, [markStateRestored]);

  const fetchPartnerAndReveal = useCallback(
    async (matchId: string, match: Database["public"]["Tables"]["matches"]["Row"]) => {
      const partnerId = match.user_1 === userId ? match.user_2 : match.user_1;
      if (!partnerId) {
        return;
      }

      const { data: profile } = await supabase
        .rpc("get_partner_profile", {
          target_profile_id: partnerId,
        })
        .maybeSingle();

      if (profile) {
        setRevealState({ matchId, partner: profile });
      }
    },
    [supabase, userId],
  );

  const resolveMatchedState = useCallback(async (): Promise<boolean> => {
    const { data: ongoingMatch, error } = await supabase
      .from("matches")
      .select("*")
      .or(`user_1.eq.${userId},user_2.eq.${userId}`)
      .in("status", ["active", "finished"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !ongoingMatch?.id) return false;

    const recoveredCourse =
      getCourseById(ongoingMatch.course_id) ?? getRecoveredWaitingCourse(restoredCourse);
    setActiveCourse(recoveredCourse);
    setIsSearching(false);
    await fetchPartnerAndReveal(ongoingMatch.id, ongoingMatch);
    return true;
  }, [fetchPartnerAndReveal, restoredCourse, supabase, userId]);

  useEffect(() => {
    if (isSessionChecking) return;

    let isMounted = true;
    let shouldKeepRecoveryVisible = false;

    async function recoverStateOnMount() {
      try {
        const { data: ongoingMatch, error: ongoingMatchError } = await supabase
          .from("matches")
          .select("*")
          .or(`user_1.eq.${userId},user_2.eq.${userId}`)
          .in("status", ["active", "finished"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!isMounted) return;

        if (!ongoingMatchError && ongoingMatch?.id) {
          shouldKeepRecoveryVisible = true;
          setIsSearching(false);
          setActiveCourse(null);
          router.push(`/chat/${ongoingMatch.id}`);
          return;
        }

        const queueResult = await supabase
          .from("queues")
          .select("course_id")
          .eq("user_id", userId)
          .limit(1);

        if (!isMounted) return;

        if (queueResult.error) {
          setErrorMessage(getFriendlyErrorMessage(queueResult.error.message));
        }

        const queueCourseId = queueResult.data?.[0]?.course_id ?? null;
        const profileStatus = initialProfileStatus;
        const shouldRecoverWaiting =
          profileStatus === "waiting" ||
          (profileStatus !== "matched" && Boolean(restoredCourse)) ||
          Boolean(queueCourseId);

        if (profileStatus === "matched") {
          const hasActiveMatch = await resolveMatchedState();
          if (hasActiveMatch) {
            shouldKeepRecoveryVisible = true;
            return;
          }

          shouldKeepRecoveryVisible = true;
          setIsSearching(true);
          setActiveCourse(getCourseById(queueCourseId) ?? getRecoveredWaitingCourse(restoredCourse));
          return;
        }

        if (shouldRecoverWaiting) {
          shouldKeepRecoveryVisible = true;
          setActiveCourse(getCourseById(queueCourseId) ?? getRecoveredWaitingCourse(restoredCourse));
          setIsSearching(true);
        } else {
          setIsSearching(false);
          setActiveCourse(null);
        }
      } finally {
        if (isMounted && !shouldKeepRecoveryVisible) {
          markRecoveryCompleteOnce();
        }
      }
    }

    void recoverStateOnMount();

    return () => {
      isMounted = false;
    };
  }, [
    initialProfileStatus,
    markRecoveryCompleteOnce,
    restoredCourse,
    router,
    isSessionChecking,
    supabase,
    userId,
    resolveMatchedState,
  ]);

  useEffect(() => {
    const matchesChannel = supabase
      .channel(`matches-passive-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `user_1=eq.${userId}`,
        },
        (payload) => {
          const inserted = payload.new as Database["public"]["Tables"]["matches"]["Row"];
          if (inserted.id) {
            setIsSearching(false);
            void fetchPartnerAndReveal(inserted.id, inserted);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `user_2=eq.${userId}`,
        },
        (payload) => {
          const inserted = payload.new as Database["public"]["Tables"]["matches"]["Row"];
          if (inserted.id) {
            setIsSearching(false);
            void fetchPartnerAndReveal(inserted.id, inserted);
          }
        },
      )
      .subscribe();

    const profileChannel = supabase
      .channel(`profile-status-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Database["public"]["Tables"]["profiles"]["Row"];

          if (updated.status === "matched") {
            void resolveMatchedState().then((hasActiveMatch) => {
              if (!hasActiveMatch) {
                setIsSearching(true);
                setActiveCourse((prev) => prev ?? getRecoveredWaitingCourse(restoredCourse));
              }
            });
            return;
          }

          if (updated.status === "waiting") {
            setIsSearching(true);
            setActiveCourse((prev) => prev ?? getRecoveredWaitingCourse(restoredCourse));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(matchesChannel);
      void supabase.removeChannel(profileChannel);
    };
  }, [fetchPartnerAndReveal, resolveMatchedState, restoredCourse, supabase, userId]);

  useEffect(() => {
    if (!isSearching || revealState) {
      return;
    }

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void resolveMatchedState().then((hasActiveMatch) => {
        if (cancelled || !hasActiveMatch) {
          return;
        }

        window.clearInterval(intervalId);
      });
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isSearching, revealState, resolveMatchedState]);

  async function handleEnterBooth(matchId: string) {
    if (isEnteringBooth) {
      return;
    }

    setIsEnteringBooth(true);
    setErrorMessage("");

    for (const retryDelayMs of MATCH_ENTRY_RETRY_DELAYS_MS) {
      if (retryDelayMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
      }

      const { data, error } = await supabase
        .from("matches")
        .select("id")
        .eq("id", matchId)
        .maybeSingle();

      if (data?.id) {
        router.push(`/chat/${matchId}`);
        return;
      }

      if (error) {
        setErrorMessage(getFriendlyErrorMessage(error.message));
        setIsEnteringBooth(false);
        return;
      }
    }

    setErrorMessage("Match is still syncing. Please try again in a moment.");
    setIsEnteringBooth(false);
  }

  async function handleEnroll(course: Course) {
    if (isSubmitting || isSearching || isInitialLoading) return;
    if (!genderIdentity) {
      setErrorMessage("Profile gender identity is missing. Re-run setup.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    const parsed = enrolCourseSchema.safeParse({
      p_course_id: course.id,
      p_gender_identity: genderIdentity,
      p_email_domain: emailDomain,
    });

    if (!parsed.success) {
      setIsSubmitting(false);
      setErrorMessage(
        parsed.error.flatten().fieldErrors.p_course_id?.[0] ??
        parsed.error.flatten().fieldErrors.p_gender_identity?.[0] ??
        parsed.error.flatten().fieldErrors.p_email_domain?.[0] ??
        "Invalid enrollment input.",
      );
      return;
    }

    const csrfToken = await getCsrfToken();
    const response = await fetch("/api/matching", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: csrfToken,
      },
      body: JSON.stringify({
        action: "enrol",
        payload: parsed.data,
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const error = await handleProtectedResponse(response, () => router.push("/login"));
      setErrorMessage(error ?? "Failed to enroll in course.");
      return;
    }

    const payload = (await response.json()) as { matchId?: string | null };
    const matchId = extractMatchId(payload.matchId ?? null);
    if (matchId) {
      const { data: matchRow } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (matchRow) {
        setActiveCourse(course);
        setIsSearching(false);
        await fetchPartnerAndReveal(matchId, matchRow);
      } else {
        router.push(`/chat/${matchId}`);
      }
      return;
    }

    setActiveCourse(course);
    setIsSearching(true);
  }

  async function handleCancelSearch() {
    if (isCancelling) return;
    setIsCancelling(true);
    const csrfToken = await getCsrfToken();
    const response = await fetch("/api/matching", {
      method: "DELETE",
      headers: {
        [CSRF_HEADER_NAME]: csrfToken,
      },
    });
    setIsCancelling(false);
    if (!response.ok) {
      const error = await handleProtectedResponse(response, () => router.push("/login"));
      setErrorMessage(error ?? "Failed to cancel search.");
      return;
    }
    setIsSearching(false);
    setActiveCourse(null);
    showToast("Search cancelled.", "info");
  }

  return (
    <>
      {revealState && activeCourse ? (
        <MatchRevealModal
          matchId={revealState.matchId}
          courseLabel={activeCourse.label}
          partner={revealState.partner}
          isEnteringBooth={isEnteringBooth}
          onEnterBooth={() => void handleEnterBooth(revealState.matchId)}
        />
      ) : null}

      {isSearching && activeCourse && !revealState ? (
        <MatchingOverlay
          courseLabel={activeCourse.label}
          broadenedSearchLabel={universityName?.trim() || emailDomain}
          isCancelling={isCancelling}
          onCancel={handleCancelSearch}
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
              <div className="w-full max-w-sm rounded-md border border-rose-400/40 bg-rose-950/80 px-3 py-2 text-sm text-rose-100">
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
                {COURSES.length} Courses
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
                          {/* eslint-disable-next-line @next/next/no-img-element -- external course image URL */}
                          <img
                            src={course.imageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
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
                          You might match with someone who is into other course
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
                          onClick={() => handleEnroll(course)}
                          disabled={isSubmitting || isSearching || isInitialLoading}
                          className="group/btn flex items-center gap-1 rounded border border-primary-amber/50 bg-surface-dark py-2 px-5 font-mono text-sm font-bold text-primary-amber shadow-[0_0_10px_rgba(255,179,0,0.1)] transition-all hover:bg-primary-amber hover:text-black hover:shadow-[0_0_20px_rgba(255,179,0,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmitting ? "Enrolling..." : "Enroll"}
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
