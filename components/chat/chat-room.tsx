"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { MessageBubble } from "@/components/chat/message-bubble";
import { ReportModal } from "@/components/chat/report-modal";
import { useToast } from "@/components/ui/toast-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getFriendlyErrorMessage,
  handleProtectedResponse,
  sanitizeInlineTextInput,
  sanitizePlainTextInput,
} from "@/lib/client/security-ui";
import { createClient } from "@/lib/supabase/client";
import { CSRF_HEADER_NAME } from "@/lib/security/csrf-shared";
import { getCsrfToken } from "@/lib/security/csrf-client";
import type { Database } from "@/lib/supabase/database.types";
import { messageContentSchema, sendMessageSchema } from "@/lib/validations/matching";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type ChatRoomProps = {
  currentUserId: string;
  match: Match;
  initialMessages: Message[];
};

function getSafeTimestamp(value: string | null): number {
  return value ? new Date(value).getTime() : 0;
}

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const byId = new Map<string, Message>();

  for (const message of existing) {
    byId.set(message.id, message);
  }

  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const timeDiff = getSafeTimestamp(a.created_at) - getSafeTimestamp(b.created_at);

    if (timeDiff !== 0) {
      return timeDiff;
    }

    return a.id.localeCompare(b.id);
  });
}

const chatMessageFormSchema = z.object({
  content: messageContentSchema,
});

function isMatchEndedStatus(status: Match["status"]) {
  return (
    status === "reported" ||
    status === "finished" ||
    status === "graded" ||
    status === "expired"
  );
}

export function ChatRoom({
  currentUserId,
  match,
  initialMessages,
}: ChatRoomProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const [messages, setMessages] = useState(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCompleteMatchModalOpen, setIsCompleteMatchModalOpen] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccessToast, setReportSuccessToast] = useState(false);
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
  /** True while/after this client submitted the report (avoids "you are reported" for the reporter). */
  const isReporterRef = useRef(false);
  const matchStatusRef = useRef<Match["status"]>(match.status);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    matchStatusRef.current = matchStatus;
  }, [matchStatus]);

  const applyMatchStatus = useCallback((status: Match["status"]) => {
    setMatchStatus(status);

    if (status === "reported" || status === "expired") {
      setIsChatLocked(true);
      setPartnerGradeAlert(null);
      setIsReportModalOpen(false);
      setIsCompleteMatchModalOpen(false);
      if (status === "reported" && !isReporterRef.current) {
        setShowBeingReportedAsTargetModal(true);
      }
      return;
    }

    if (status === "finished" || status === "graded") {
      setIsChatLocked(true);
      setPartnerGradeAlert((prev) => {
        if (prev) {
          return prev;
        }
        return "Your partner has ended the conversation. Time to grade!";
      });
      return;
    }

    setIsChatLocked(false);
    setPartnerGradeAlert(null);
  }, []);
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<z.infer<typeof chatMessageFormSchema>>({
    defaultValues: {
      content: "",
    },
    mode: "onChange",
    resolver: zodResolver(chatMessageFormSchema),
  });
  const draft = watch("content");
  const currentCourseName = match.course_id ?? "Unknown Course";
  const partnerId = match.user_1 === currentUserId ? match.user_2 : match.user_1;
  const isReported = matchStatus === "reported" || matchStatus === "expired";
  const isRatingPhase = matchStatus === "finished" || matchStatus === "graded";
  const isActive = !isReported && !isRatingPhase;
  const timelineLabel = useMemo(() => {
    if (messages.length === 0) {
      return "Today";
    }

    const latestValue = messages[messages.length - 1]?.created_at;
    if (!latestValue) {
      return "Today";
    }

    const latest = new Date(latestValue);
    return `Today, ${latest.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    async function fetchPartnerProfile() {
      if (!partnerId) {
        return;
      }

      const { data } = await supabase
        .rpc("get_partner_profile", {
          target_profile_id: partnerId,
        })
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

      if (!isMounted) {
        return;
      }

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

    async function checkIncomingRating() {
      const { data, error } = await supabase
        .from("ratings")
        .select("grade_point")
        .eq("match_id", match.id)
        .eq("rated_user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isMounted || error || !data) {
        return;
      }

      setIsChatLocked(true);
      setPartnerGradeAlert(
        `Your partner graded you ${data.grade_point.toFixed(2)}! Please submit your final grade.`,
      );
    }

    void checkIncomingRating();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, match.id, supabase]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    let isCancelled = false;
    const intervalId = window.setInterval(() => {
      void supabase
        .from("messages")
        .select("id, match_id, sender_id, content, created_at")
        .eq("match_id", match.id)
        .order("created_at", { ascending: true })
        .then(({ data, error }) => {
          if (isCancelled || error || !data) {
            return;
          }

          setMessages((prev) => mergeMessages(prev, data));
        });
    }, 1500);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isActive, match.id, supabase]);

  /** Realtime for matches is easy to miss (publication, reconnect); poll until terminal status. */
  useEffect(() => {
    if (matchStatus === "reported" || matchStatus === "expired") {
      return;
    }

    let cancelled = false;

    function pollMatchStatus() {
      void supabase
        .from("matches")
        .select("status")
        .eq("id", match.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (cancelled || error || !data?.status) {
            return;
          }

          if (data.status !== matchStatusRef.current) {
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
      .channel(`match_updates_${match.id}`, {
        config: { broadcast: { self: true } },
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${match.id}`,
        },
        (payload) => {
          const updated = payload.new as Match;
          applyMatchStatus(updated.status);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${match.id}`,
        },
        () => {
          applyMatchStatus("finished");
        },
      )
      .subscribe();

    const messageChannel = supabase
      .channel(`chat-messages-${match.id}`, {
        config: { broadcast: { self: true } },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => mergeMessages(prev, [newMessage]));
        },
      )
      .subscribe();

    const ratingChannel = supabase
      .channel(`chat-ratings-${match.id}`, {
        config: { broadcast: { self: true } },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ratings",
          filter: `match_id=eq.${match.id}`,
        },
        (payload) => {
          const newRating = payload.new as Database["public"]["Tables"]["ratings"]["Row"];
          if (newRating.rated_user_id !== currentUserId) {
            return;
          }

          const grade = newRating.grade_point.toFixed(2);
          setMatchStatus((prev) => (prev === "reported" || prev === "expired" ? prev : "graded"));
          setIsChatLocked(true);
          setPartnerGradeAlert(
            `Your partner graded you ${grade}! Please submit your final grade.`,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(ratingChannel);
    };
  }, [applyMatchStatus, currentUserId, match.id, supabase]);

  async function handleSendMessage(values: z.infer<typeof chatMessageFormSchema>) {
    const content = sanitizePlainTextInput(values.content);
    if (!content || isSending || isChatLocked || isSubmittingReport) {
      return;
    }

    const parsed = sendMessageSchema.safeParse({
      match_id: match.id,
      sender_id: currentUserId,
      content,
    });

    if (!parsed.success) {
      setErrorMessage(
        parsed.error.flatten().fieldErrors.content?.[0] ?? "Invalid message input.",
      );
      return;
    }

    const optimisticId = `pending:${crypto.randomUUID()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      match_id: match.id,
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => mergeMessages(prev, [optimisticMessage]));
    setValue("content", "", { shouldDirty: false, shouldValidate: false });
    setIsSending(true);
    setErrorMessage("");

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER_NAME]: csrfToken,
        },
        body: JSON.stringify({
          match_id: parsed.data.match_id,
          content: parsed.data.content,
        }),
      });

      if (!response.ok) {
        const error = await handleProtectedResponse(response, () => router.push("/login"));
        setErrorMessage(error ?? "Failed to send message.");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        return;
      }

      let payload: { message?: Message };
      try {
        payload = (await response.json()) as { message?: Message };
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setErrorMessage("Failed to read server response. Please try again.");
        return;
      }

      const insertedMessage = payload.message;
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== optimisticId);
        if (insertedMessage) {
          return mergeMessages(withoutPending, [insertedMessage]);
        }
        return withoutPending;
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setErrorMessage(getFriendlyErrorMessage("Network issue detected. Please try again."));
    } finally {
      setIsSending(false);
    }
  }

  const redirectHomeAsReportedTarget = useCallback(() => {
    setShowBeingReportedAsTargetModal(false);
    router.replace("/");
  }, [router]);

  useEffect(() => {
    if (!showBeingReportedAsTargetModal) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      redirectHomeAsReportedTarget();
    }, 6000);

    return () => window.clearTimeout(timeoutId);
  }, [showBeingReportedAsTargetModal, redirectHomeAsReportedTarget]);

  async function handleSubmitReport(input: {
    category: "Harassment" | "Fake Profile" | "No-show" | "Other";
    details: string;
  }) {
    isReporterRef.current = true;
    setErrorMessage("");
    setIsSubmittingReport(true);

    const csrfToken = await getCsrfToken();
    const reportResponse = await fetch("/api/matching", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: csrfToken,
      },
      body: JSON.stringify({
        action: "report",
        payload: {
          match_id: match.id,
          category: input.category,
          details: input.details,
        },
      }),
    });

    if (!reportResponse.ok) {
      isReporterRef.current = false;
      setIsSubmittingReport(false);
      const error = await handleProtectedResponse(reportResponse, () => router.push("/login"));
      setErrorMessage(error ?? "Report submission failed. Please contact support.");
      return;
    }

    setIsSubmittingReport(false);
    setIsReportModalOpen(false);
    setReportSuccessToast(true);
    showToast("Report submitted to the Academic Board.", "success");
    setTimeout(() => {
      router.replace("/");
    }, 900);
  }

  function handleGoToGrading() {
    setIsCompleteMatchModalOpen(true);
  }

  function handleConfirmCompleteMatch() {
    setIsCompleteMatchModalOpen(false);
    router.push(`/grading/${match.id}`);
  }

  const subHeader = (
    <section className="sticky top-0 z-20 mt-[60px] border-b border-primary-amber/20 bg-stone-950/95 backdrop-blur-md">
      {/* Brass rail accent */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-primary-amber/50 to-transparent shadow-[0_0_8px_rgba(255,177,0,0.3)]" />
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3 md:max-w-4xl lg:max-w-5xl">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary-amber/70">local_bar</span>
            <p className="truncate font-mono text-xs font-bold uppercase tracking-[0.12em] text-primary-amber">
              {currentCourseName}
            </p>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
            {isReported
              ? "// SESSION TERMINATED"
              : isRatingPhase
                ? "// GRADING PHASE"
                : "// PRIVATE BOOTH — ACTIVE"}
          </p>
        </div>

        {isReported ? (
          <button
            type="button"
            className="shrink-0 rounded-full border border-amber-300/40 bg-amber-950/50 px-3 py-1.5 font-mono text-xs font-semibold text-amber-100 transition hover:bg-amber-900/80"
            onClick={() => router.push("/")}
          >
            Back to Home
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            {!isRatingPhase ? (
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="rounded-full border border-rose-400/30 bg-rose-950/50 px-3 py-1.5 font-mono text-xs font-semibold text-rose-300 transition hover:bg-rose-900/60"
                disabled={isSubmittingReport}
              >
                Report
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-primary-amber/30 bg-primary-amber px-3 py-1.5 font-mono text-xs font-semibold text-black transition hover:bg-amber-300"
              onClick={handleGoToGrading}
            >
              Go to Grading
            </button>
          </div>
        )}
      </div>

      {/* Partner profile strip — fixed below report/grading row */}
      <div className="mx-auto flex w-full max-w-md items-center gap-3 border-t border-white/5 px-4 py-2.5 md:max-w-4xl lg:max-w-5xl">
        {partnerProfile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase avatar URL
          <img
            src={partnerProfile.avatar_url}
            alt=""
            className="size-9 shrink-0 rounded-full border border-primary-amber/20 object-cover"
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary-amber/20 bg-stone-800">
            <span className="material-symbols-outlined text-lg text-primary-amber/60">person</span>
          </div>
        )}
        <span className="truncate font-mono text-sm font-medium text-white">
          {partnerProfile?.display_name ?? "Partner"}
        </span>
      </div>
    </section>
  );

  if (isReported) {
    return (
      <main className="relative flex min-h-screen flex-col overflow-hidden bg-stone-950 font-display text-slate-100">
        <Dialog
          open={showBeingReportedAsTargetModal}
          onOpenChange={() => {
            /* Do not dismiss via overlay — user must acknowledge or wait for auto-redirect. */
          }}
        >
          <DialogContent className="border-rose-400/30 bg-stone-900/98 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="font-mono text-rose-200">
                You are being reported
              </DialogTitle>
              <DialogDescription className="font-mono text-xs text-slate-400">
                Your match partner submitted a report. This session has ended. You will be
                redirected to the home page. If you believe this is a mistake, contact support
                through official channels.
              </DialogDescription>
            </DialogHeader>
            <p className="mt-2 font-mono text-[11px] text-slate-500">
              Redirecting automatically in a few seconds…
            </p>
            <button
              type="button"
              onClick={() => redirectHomeAsReportedTarget()}
              className="mt-4 w-full rounded-full border border-primary-amber/30 bg-primary-amber px-4 py-3 font-mono text-sm font-semibold text-black transition hover:bg-amber-300"
            >
              Go to home now
            </button>
          </DialogContent>
        </Dialog>

        <div className="pointer-events-none absolute inset-0 wood-texture opacity-10" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,177,0,0.06)_0%,transparent_60%)]" />
        {subHeader}
        <section className="relative z-10 flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-primary-amber/20 bg-stone-900/60 p-6 text-center shadow-2xl backdrop-blur-xl md:max-w-2xl">
            <span className="material-symbols-outlined mb-3 text-4xl text-red-400/60">block</span>
            <p className="font-mono text-lg font-semibold text-white">Session Terminated</p>
            <p className="mt-1 font-mono text-xs text-slate-400">
              {showBeingReportedAsTargetModal
                ? "Please read the notice above."
                : "This match has been closed by the system."}
            </p>
            {!showBeingReportedAsTargetModal ? (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-5 w-full rounded-full border border-primary-amber/30 bg-primary-amber px-4 py-3 font-mono text-sm font-semibold text-black transition hover:bg-amber-300"
              >
                Back to Taproom
              </button>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-stone-950 font-display text-slate-100">
      <ReportModal
        open={isReportModalOpen}
        onOpenChange={setIsReportModalOpen}
        onSubmit={handleSubmitReport}
        isSubmitting={isSubmittingReport}
      />
      <Dialog
        open={isCompleteMatchModalOpen}
        onOpenChange={setIsCompleteMatchModalOpen}
      >
        <DialogContent className="border-primary-amber/20 bg-stone-900/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary-amber">Complete Match?</DialogTitle>
            <DialogDescription className="font-mono text-xs text-slate-400">
              Proceed to the grading phase for this session.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsCompleteMatchModalOpen(false)}
              className="w-auto rounded-full border border-slate-600 px-4 py-2.5 font-mono text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmCompleteMatch}
              className="w-auto rounded-full border border-primary-amber/30 bg-primary-amber px-4 py-2.5 font-mono text-sm font-semibold text-black transition-colors hover:bg-amber-300"
            >
              Complete Match
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Warm booth atmosphere */}
      <div className="pointer-events-none absolute inset-0 wood-texture opacity-[0.06]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,177,0,0.05)_0%,transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.03)_0%,transparent_40%)]" />

      <section className="relative z-10 mx-auto flex h-full w-full max-w-md flex-col md:max-w-4xl lg:max-w-5xl">
        {reportSuccessToast ? (
          <div className="fixed top-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-emerald-300/40 bg-emerald-950/95 px-3 py-2 text-sm text-emerald-100 md:max-w-xl">
            Report submitted to the Academic Board.
          </div>
        ) : null}

        {subHeader}

        <main className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
          <div className="mb-6 flex justify-center">
            <span className="rounded-full border border-primary-amber/10 bg-stone-900/80 px-3 py-1 font-mono text-[10px] font-medium tracking-wider text-slate-500 uppercase">
              {timelineLabel}
            </span>
          </div>

          {errorMessage ? (
            <div className="mb-3 rounded-md border border-rose-300/40 bg-rose-950/80 px-3 py-2 text-sm text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          {isRatingPhase ? (
            <div className="mb-4 rounded-xl border border-primary-amber/30 bg-stone-900/70 px-4 py-3 backdrop-blur">
              <p className="font-mono text-xs text-primary-amber/90">
                {partnerGradeAlert ??
                  "Your match is ready for grading. Please submit your final grade."}
              </p>
              <button
                type="button"
                className="mt-3 rounded-full border border-primary-amber/30 bg-primary-amber px-4 py-2 font-mono text-xs font-semibold text-black transition hover:bg-amber-300"
                onClick={() => router.push(`/grading/${match.id}`)}
              >
                Rate Your Partner
              </button>
            </div>
          ) : null}

          {isActive ? (
            <div className="space-y-4">
              {isLoadingMessages ? (
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-slate-500">
                  Loading messages...
                </p>
              ) : null}
              {messages.map((message) => {
                const isOwn = message.sender_id === currentUserId;
                const isPending = isOwn && message.id.startsWith("pending:");
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={isOwn}
                    isPending={isPending}
                  />
                );
              })}
              <div ref={bottomRef} className="h-36 shrink-0" />
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-5 text-sm text-zinc-300">
              Chat has moved to grading mode.
            </div>
          )}
        </main>

        <div className="fixed right-0 bottom-[80px] left-0 z-30 mx-auto w-full max-w-md px-4 pb-4 md:max-w-4xl lg:max-w-5xl">
          <div className="mx-auto w-full max-w-md overflow-hidden rounded-full border border-primary-amber/15 bg-stone-900/90 p-2 pl-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-lg md:max-w-2xl">
            <form
              className="flex items-center gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit(handleSendMessage)();
              }}
            >
              <input
                {...register("content")}
                value={draft}
                onChange={(event) =>
                  setValue("content", sanitizeInlineTextInput(event.target.value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder={isChatLocked ? "// session locked" : "Buy a round of words..."}
                maxLength={500}
                disabled={isSending || isChatLocked || isSubmittingReport}
                className="w-full bg-transparent py-2 text-[15px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
              />
              <button
                type="submit"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-amber text-black shadow-[0_0_15px_rgba(255,177,0,0.3)] transition-all active:scale-95 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isSending || isChatLocked || isSubmittingReport}
                aria-label="Send message"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </form>
            {errors.content?.message ? (
              <p className="mt-2 px-2 text-xs text-rose-300">
                {errors.content.message}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
