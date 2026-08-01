"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  sendChatMessageRequest,
  submitMatchReportRequest,
  type ReportInput,
} from "@/lib/client/chat-service";
import {
  getFriendlyErrorMessage,
  sanitizePlainTextInput,
} from "@/lib/client/security-ui";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { sendMessageSchema } from "@/lib/validations/matching";

type Match = Database["public"]["Tables"]["matches"]["Row"];
export type ChatMessage = Database["public"]["Tables"]["messages"]["Row"];

function getSafeTimestamp(value: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

export function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();

  for (const message of existing) {
    byId.set(message.id, message);
  }

  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const timeDiff = getSafeTimestamp(a.created_at) - getSafeTimestamp(b.created_at);
    return timeDiff !== 0 ? timeDiff : a.id.localeCompare(b.id);
  });
}

export function isMatchEndedStatus(status: Match["status"]): boolean {
  return (
    status === "reported" ||
    status === "finished" ||
    status === "graded" ||
    status === "expired"
  );
}

export function useChatSession(input: {
  currentUserId: string;
  match: Match;
  initialMessages: ChatMessage[];
  onUnauthorized: () => void;
}) {
  const { currentUserId, match, initialMessages, onUnauthorized } = input;
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportErrorMessage, setReportErrorMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [matchStatus, setMatchStatus] = useState<Match["status"]>(match.status);
  const [partnerGradeAlert, setPartnerGradeAlert] = useState<string | null>(
    match.status === "graded" || match.status === "finished"
      ? "Your partner has ended the conversation. Time to grade!"
      : null,
  );
  const [isChatLocked, setIsChatLocked] = useState(isMatchEndedStatus(match.status));
  const [partnerProfile, setPartnerProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [showBeingReportedAsTargetModal, setShowBeingReportedAsTargetModal] =
    useState(false);
  const isReporterRef = useRef(false);
  const matchStatusRef = useRef<Match["status"]>(match.status);

  useEffect(() => {
    matchStatusRef.current = matchStatus;
  }, [matchStatus]);

  const applyMatchStatus = useCallback((status: Match["status"]) => {
    setMatchStatus(status);

    if (status === "reported" || status === "expired") {
      setIsChatLocked(true);
      setPartnerGradeAlert(null);
      if (status === "reported" && !isReporterRef.current) {
        setShowBeingReportedAsTargetModal(true);
      }
      return;
    }

    if (status === "finished" || status === "graded") {
      setIsChatLocked(true);
      setPartnerGradeAlert(
        (current) => current ?? "Your partner has ended the conversation. Time to grade!",
      );
      return;
    }

    setIsChatLocked(false);
    setPartnerGradeAlert(null);
  }, []);

  const partnerId = match.user_1 === currentUserId ? match.user_2 : match.user_1;
  const isReported = matchStatus === "reported" || matchStatus === "expired";
  const isRatingPhase = matchStatus === "finished" || matchStatus === "graded";
  const isActive = !isReported && !isRatingPhase;

  useEffect(() => {
    let isMounted = true;

    async function fetchPartnerProfile() {
      if (!partnerId) return;
      const { data } = await supabase
        .rpc("get_partner_profile", { target_profile_id: partnerId })
        .maybeSingle();

      if (isMounted && data) {
        setPartnerProfile({
          display_name: data.display_name ?? null,
          avatar_url: data.avatar_url ?? null,
        });
      }
    }

    void fetchPartnerProfile();
    return () => {
      isMounted = false;
    };
  }, [partnerId, supabase]);

  useEffect(() => {
    let isMounted = true;

    async function fetchInitialMessages() {
      setIsLoadingMessages(true);
      const { data, error } = await supabase
        .from("messages")
        .select("id, match_id, sender_id, content, created_at")
        .eq("match_id", match.id)
        .order("created_at", { ascending: true });

      if (!isMounted) return;
      setIsLoadingMessages(false);

      if (error) {
        setErrorMessage(getFriendlyErrorMessage(error.message));
        return;
      }
      setMessages(data ?? []);
    }

    void fetchInitialMessages();
    return () => {
      isMounted = false;
    };
  }, [match.id, supabase]);

  useEffect(() => {
    let isMounted = true;
    void supabase
      .from("ratings")
      .select("grade_point")
      .eq("match_id", match.id)
      .eq("rated_user_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted || error || !data) return;
        setIsChatLocked(true);
        setPartnerGradeAlert(
          `Your partner graded you ${data.grade_point.toFixed(2)}! Please submit your final grade.`,
        );
      });

    return () => {
      isMounted = false;
    };
  }, [currentUserId, match.id, supabase]);

  useEffect(() => {
    if (!isActive) return;
    let isCancelled = false;
    const intervalId = window.setInterval(() => {
      void supabase
        .from("messages")
        .select("id, match_id, sender_id, content, created_at")
        .eq("match_id", match.id)
        .order("created_at", { ascending: true })
        .then(({ data, error }) => {
          if (!isCancelled && !error && data) {
            setMessages((current) => mergeMessages(current, data));
          }
        });
    }, 5000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isActive, match.id, supabase]);

  useEffect(() => {
    if (matchStatus === "reported" || matchStatus === "expired") return;
    let cancelled = false;

    function pollMatchStatus() {
      void supabase
        .from("matches")
        .select("status")
        .eq("id", match.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (
            !cancelled &&
            !error &&
            data?.status &&
            data.status !== matchStatusRef.current
          ) {
            applyMatchStatus(data.status);
          }
        });
    }

    pollMatchStatus();
    const intervalId = window.setInterval(pollMatchStatus, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyMatchStatus, match.id, matchStatus, supabase]);

  useEffect(() => {
    const matchChannel = supabase
      .channel(`match_updates_${match.id}`, { config: { broadcast: { self: true } } })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${match.id}` },
        (payload) => applyMatchStatus((payload.new as Match).status),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "matches", filter: `id=eq.${match.id}` },
        () => applyMatchStatus("finished"),
      )
      .subscribe();

    const messageChannel = supabase
      .channel(`chat-messages-${match.id}`, { config: { broadcast: { self: true } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${match.id}` },
        (payload) => {
          setMessages((current) => mergeMessages(current, [payload.new as ChatMessage]));
        },
      )
      .subscribe();

    const ratingChannel = supabase
      .channel(`chat-ratings-${match.id}`, { config: { broadcast: { self: true } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ratings", filter: `match_id=eq.${match.id}` },
        (payload) => {
          const rating = payload.new as Database["public"]["Tables"]["ratings"]["Row"];
          if (rating.rated_user_id !== currentUserId) return;
          setMatchStatus((current) =>
            current === "reported" || current === "expired" ? current : "graded",
          );
          setIsChatLocked(true);
          setPartnerGradeAlert(
            `Your partner graded you ${rating.grade_point.toFixed(2)}! Please submit your final grade.`,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(matchChannel);
      void supabase.removeChannel(messageChannel);
      void supabase.removeChannel(ratingChannel);
    };
  }, [applyMatchStatus, currentUserId, match.id, supabase]);

  const sendMessage = useCallback(
    async (rawContent: string): Promise<boolean> => {
      const content = sanitizePlainTextInput(rawContent);
      if (!content || isSending || isChatLocked || isSubmittingReport) return false;

      const parsed = sendMessageSchema.safeParse({
        match_id: match.id,
        sender_id: currentUserId,
        content,
      });
      if (!parsed.success) {
        setErrorMessage(
          parsed.error.flatten().fieldErrors.content?.[0] ?? "Invalid message input.",
        );
        return false;
      }

      const optimisticId = `pending:${crypto.randomUUID()}`;
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        match_id: match.id,
        sender_id: currentUserId,
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((current) => mergeMessages(current, [optimisticMessage]));
      setIsSending(true);
      setErrorMessage("");

      try {
        const result = await sendChatMessageRequest({
          matchId: match.id,
          content,
          onUnauthorized,
        });
        if (!result.ok) {
          setMessages((current) => current.filter((item) => item.id !== optimisticId));
          setErrorMessage(result.message);
          return false;
        }

        setMessages((current) => {
          const withoutPending = current.filter((item) => item.id !== optimisticId);
          return result.data.message
            ? mergeMessages(withoutPending, [result.data.message])
            : withoutPending;
        });
        return true;
      } catch {
        setMessages((current) => current.filter((item) => item.id !== optimisticId));
        setErrorMessage("Network issue detected. Please try again.");
        return false;
      } finally {
        setIsSending(false);
      }
    }, [currentUserId, isChatLocked, isSending, isSubmittingReport, match.id, onUnauthorized],
  );

  const submitReport = useCallback(
    async (report: ReportInput): Promise<boolean> => {
      isReporterRef.current = true;
      setReportErrorMessage("");
      setIsSubmittingReport(true);
      try {
        const result = await submitMatchReportRequest({
          matchId: match.id,
          report,
          onUnauthorized,
        });
        if (!result.ok) {
          isReporterRef.current = false;
          setReportErrorMessage(result.message);
          return false;
        }
        return true;
      } catch {
        isReporterRef.current = false;
        setReportErrorMessage(
          "We couldn't reach the reporting service. Check your connection and try again.",
        );
        return false;
      } finally {
        setIsSubmittingReport(false);
      }
    }, [match.id, onUnauthorized],
  );

  const clearReportError = useCallback(() => setReportErrorMessage(""), []);
  const acknowledgeReported = useCallback(
    () => setShowBeingReportedAsTargetModal(false),
    [],
  );

  return {
    messages,
    isLoadingMessages,
    isSending,
    isSubmittingReport,
    reportErrorMessage,
    clearReportError,
    errorMessage,
    matchStatus,
    partnerGradeAlert,
    isChatLocked,
    partnerProfile,
    showBeingReportedAsTargetModal,
    acknowledgeReported,
    isReported,
    isRatingPhase,
    sendMessage,
    submitReport,
  };
}
