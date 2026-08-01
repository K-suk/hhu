"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  cancelMatchingRequest,
  enrolInCourseRequest,
} from "@/lib/client/matching-service";
import { getFriendlyErrorMessage } from "@/lib/client/security-ui";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { enrolCourseSchema } from "@/lib/validations/matching";

export type Course = {
  id: string;
  label: string;
  code: string;
  badge: "Core" | "Elec" | "Lab";
  abv: string;
  ibu: string;
  imageUrl?: string | null;
};

export const COURSES: Course[] = [
  {
    id: "beer-101",
    label: "BEER 101",
    code: "From keg to glass: applied thermodynamics and friendship formation.",
    badge: "Core",
    abv: "5.0%",
    ibu: "25",
    imageUrl: "/images/beer101.jpg",
  },
];

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];

export type RevealState = {
  matchId: string;
  partner: Pick<ProfileRow, "display_name" | "avatar_url" | "department">;
};

const MATCH_ENTRY_RETRY_DELAYS_MS = [0, 200, 400, 800, 1200] as const;

export function getCourseById(courseId: string | null | undefined): Course | null {
  if (!courseId) return null;
  return (
    COURSES.find((course) => course.id === courseId) ?? {
      id: courseId,
      label: courseId.toUpperCase(),
      code: "Recovered from active queue session.",
      badge: "Core",
      abv: "--",
      ibu: "--",
      imageUrl: null,
    }
  );
}

function getRecoveredWaitingCourse(fallbackCourse: Course | null): Course {
  return (
    fallbackCourse ?? {
      id: "queue-recovery",
      label: "QUEUE SYNC",
      code: "Recovered waiting state from profile status.",
      badge: "Core",
      abv: "--",
      ibu: "--",
      imageUrl: null,
    }
  );
}

type ToastKind = "success" | "error" | "info";

export function useMatchingSession(input: {
  userId: string;
  genderIdentity: ProfileRow["gender_identity"];
  emailDomain: string;
  pendingCourseId?: string | null;
  initialProfileStatus: string | null;
  isInitialLoading: boolean;
  isSessionChecking: boolean;
  markStateRestored: () => void;
  onNavigate: (path: string) => void;
  onUnauthorized: () => void;
  onToast: (message: string, kind: ToastKind) => void;
}) {
  const {
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
  } = input;
  const supabase = useMemo(() => createClient(), []);
  const restoredCourse = useMemo(() => getCourseById(pendingCourseId), [pendingCourseId]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(Boolean(restoredCourse));
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
    async (matchId: string, match: MatchRow) => {
      const partnerId = match.user_1 === userId ? match.user_2 : match.user_1;
      if (!partnerId) return;
      const { data: profile } = await supabase
        .rpc("get_partner_profile", { target_profile_id: partnerId })
        .maybeSingle();
      if (profile) setRevealState({ matchId, partner: profile });
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

    setActiveCourse(
      getCourseById(ongoingMatch.course_id) ?? getRecoveredWaitingCourse(restoredCourse),
    );
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
          onNavigate(`/chat/${ongoingMatch.id}`);
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
        const shouldRecoverWaiting =
          initialProfileStatus === "waiting" ||
          (initialProfileStatus !== "matched" && Boolean(restoredCourse)) ||
          Boolean(queueCourseId);

        if (initialProfileStatus === "matched") {
          if (await resolveMatchedState()) {
            shouldKeepRecoveryVisible = true;
            return;
          }
          shouldKeepRecoveryVisible = true;
          setIsSearching(true);
          setActiveCourse(
            getCourseById(queueCourseId) ?? getRecoveredWaitingCourse(restoredCourse),
          );
          return;
        }

        if (shouldRecoverWaiting) {
          shouldKeepRecoveryVisible = true;
          setActiveCourse(
            getCourseById(queueCourseId) ?? getRecoveredWaitingCourse(restoredCourse),
          );
          setIsSearching(true);
        } else {
          setIsSearching(false);
          setActiveCourse(null);
        }
      } finally {
        if (isMounted && !shouldKeepRecoveryVisible) markRecoveryCompleteOnce();
      }
    }

    void recoverStateOnMount();
    return () => {
      isMounted = false;
    };
  }, [
    initialProfileStatus,
    isSessionChecking,
    markRecoveryCompleteOnce,
    onNavigate,
    resolveMatchedState,
    restoredCourse,
    supabase,
    userId,
  ]);

  useEffect(() => {
    const matchesChannel = supabase
      .channel(`matches-passive-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches", filter: `user_1=eq.${userId}` },
        (payload) => {
          const match = payload.new as MatchRow;
          if (match.id) {
            setIsSearching(false);
            void fetchPartnerAndReveal(match.id, match);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches", filter: `user_2=eq.${userId}` },
        (payload) => {
          const match = payload.new as MatchRow;
          if (match.id) {
            setIsSearching(false);
            void fetchPartnerAndReveal(match.id, match);
          }
        },
      )
      .subscribe();

    const profileChannel = supabase
      .channel(`profile-status-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          const profile = payload.new as ProfileRow;
          if (profile.status === "matched") {
            void resolveMatchedState().then((hasActiveMatch) => {
              if (!hasActiveMatch) {
                setIsSearching(true);
                setActiveCourse(
                  (current) => current ?? getRecoveredWaitingCourse(restoredCourse),
                );
              }
            });
          } else if (profile.status === "waiting") {
            setIsSearching(true);
            setActiveCourse(
              (current) => current ?? getRecoveredWaitingCourse(restoredCourse),
            );
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
    if (!isSearching || revealState) return;
    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void resolveMatchedState().then((hasActiveMatch) => {
        if (!cancelled && hasActiveMatch) window.clearInterval(intervalId);
      });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isSearching, revealState, resolveMatchedState]);

  const enterBooth = useCallback(
    async (matchId: string) => {
      if (isEnteringBooth) return;
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
          onNavigate(`/chat/${matchId}`);
          return;
        }
        if (error) {
          const message = getFriendlyErrorMessage(error.message);
          setErrorMessage(message);
          onToast(message, "error");
          setIsEnteringBooth(false);
          return;
        }
      }

      const message = "Match is still syncing. Please try again in a moment.";
      setErrorMessage(message);
      onToast(message, "error");
      setIsEnteringBooth(false);
    }, [isEnteringBooth, onNavigate, onToast, supabase],
  );

  const enrolCourse = useCallback(
    async (course: Course) => {
      if (isSubmitting || isSearching || isInitialLoading) return;
      if (!genderIdentity) {
        setErrorMessage("Profile gender identity is missing. Re-run setup.");
        return;
      }

      const parsed = enrolCourseSchema.safeParse({
        p_course_id: course.id,
        p_gender_identity: genderIdentity,
        p_email_domain: emailDomain,
      });
      if (!parsed.success) {
        setErrorMessage(
          parsed.error.flatten().fieldErrors.p_course_id?.[0] ??
            parsed.error.flatten().fieldErrors.p_gender_identity?.[0] ??
            parsed.error.flatten().fieldErrors.p_email_domain?.[0] ??
            "Invalid enrollment input.",
        );
        return;
      }

      setErrorMessage("");
      setIsSubmitting(true);
      try {
        const result = await enrolInCourseRequest({
          payload: parsed.data,
          onUnauthorized,
        });
        if (!result.ok) {
          setErrorMessage(result.message);
          return;
        }

        if (result.data.matchId) {
          const { data: matchRow } = await supabase
            .from("matches")
            .select("*")
            .eq("id", result.data.matchId)
            .single();
          if (matchRow) {
            setActiveCourse(course);
            setIsSearching(false);
            await fetchPartnerAndReveal(result.data.matchId, matchRow);
          } else {
            onNavigate(`/chat/${result.data.matchId}`);
          }
          return;
        }

        setActiveCourse(course);
        setIsSearching(true);
      } catch {
        setErrorMessage(
          "We couldn't reach the matching service. Check your connection and try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
    }, [
      emailDomain,
      fetchPartnerAndReveal,
      genderIdentity,
      isInitialLoading,
      isSearching,
      isSubmitting,
      onNavigate,
      onUnauthorized,
      supabase,
    ],
  );

  const cancelSearch = useCallback(async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      const result = await cancelMatchingRequest({ onUnauthorized });
      if (!result.ok) {
        setErrorMessage(result.message);
        onToast(result.message, "error");
        return;
      }
      setIsSearching(false);
      setActiveCourse(null);
      onToast("Search cancelled.", "info");
    } catch {
      const message = "We couldn't cancel the search. Check your connection and try again.";
      setErrorMessage(message);
      onToast(message, "error");
    } finally {
      setIsCancelling(false);
    }
  }, [isCancelling, onToast, onUnauthorized]);

  return {
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
  };
}
