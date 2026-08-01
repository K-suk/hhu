"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { MessageBubble } from "@/components/chat/message-bubble";
import { ReportModal } from "@/components/chat/report-modal";
import { useChatSession } from "@/components/chat/use-chat-session";
import { useToast } from "@/components/ui/toast-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sanitizeInlineTextInput } from "@/lib/client/security-ui";
import type { Database } from "@/lib/supabase/database.types";
import { messageContentSchema } from "@/lib/validations/matching";

type Match = Database["public"]["Tables"]["matches"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type ChatRoomProps = {
  currentUserId: string;
  match: Match;
  initialMessages: Message[];
};

const chatMessageFormSchema = z.object({
  content: messageContentSchema,
});

export function ChatRoom({
  currentUserId,
  match,
  initialMessages,
}: ChatRoomProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCompleteMatchModalOpen, setIsCompleteMatchModalOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const onUnauthorized = useCallback(() => router.push("/login"), [router]);
  const {
    messages,
    isLoadingMessages,
    isSending,
    isSubmittingReport,
    reportErrorMessage,
    clearReportError,
    errorMessage,
    partnerGradeAlert,
    isChatLocked,
    partnerProfile,
    showBeingReportedAsTargetModal,
    acknowledgeReported,
    isReported,
    isRatingPhase,
    sendMessage,
    submitReport,
  } = useChatSession({ currentUserId, match, initialMessages, onUnauthorized });
  const isActive = !isReported && !isRatingPhase;
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<z.infer<typeof chatMessageFormSchema>>({
    defaultValues: {
      content: "",
    },
    mode: "onChange",
    resolver: zodResolver(chatMessageFormSchema),
  });
  const draft = useWatch({ control, name: "content" });
  const currentCourseName = match.course_id ?? "Unknown Course";
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
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages]);

  async function handleSendMessage(values: z.infer<typeof chatMessageFormSchema>) {
    setValue("content", "", { shouldDirty: false, shouldValidate: false });
    await sendMessage(values.content);
  }

  const redirectHomeAsReportedTarget = useCallback(() => {
    acknowledgeReported();
    router.replace("/");
  }, [acknowledgeReported, router]);
  const keepReportNoticeOpen = useCallback(() => {}, []);

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
    if (await submitReport(input)) {
      setIsReportModalOpen(false);
      showToast("Report submitted. This match has ended.", "success");
      router.replace("/");
    }
  }

  function handleGoToGrading() {
    setIsCompleteMatchModalOpen(true);
  }

  function handleConfirmCompleteMatch() {
    setIsCompleteMatchModalOpen(false);
    router.push(`/grading/${match.id}`);
  }

  const subHeader = (
    <section className="sticky top-0 z-20 border-b border-primary-amber/20 bg-stone-950/95 backdrop-blur-md">
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
                onClick={() => {
                  clearReportError();
                  setIsReportModalOpen(true);
                }}
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
          <Image
            src={partnerProfile.avatar_url}
            alt=""
            width={36}
            height={36}
            unoptimized
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
          dismissible={false}
          onOpenChange={keepReportNoticeOpen}
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
    <main className="relative flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-stone-950 font-display text-slate-100">
      <ReportModal
        open={isReportModalOpen}
        onOpenChange={setIsReportModalOpen}
        onSubmit={handleSubmitReport}
        isSubmitting={isSubmittingReport}
        submissionError={reportErrorMessage}
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
        {subHeader}

        <section
          aria-label="Conversation"
          className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-4 py-5"
        >
          <div className="mb-6 flex justify-center">
            <span className="rounded-full border border-primary-amber/10 bg-stone-900/80 px-3 py-1 font-mono text-[10px] font-medium tracking-wider text-slate-500 uppercase">
              {timelineLabel}
            </span>
          </div>

          {errorMessage ? (
            <div
              className="mb-3 rounded-md border border-rose-300/40 bg-rose-950/80 px-3 py-2 text-sm text-rose-100"
              role="alert"
            >
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
                <div className="rounded-2xl border border-white/5 bg-stone-900/50 p-5 text-center">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-slate-400" role="status">
                    Loading your conversation...
                  </p>
                </div>
              ) : null}
              {!isLoadingMessages && messages.length === 0 ? (
                <div className="rounded-2xl border border-primary-amber/15 bg-stone-900/50 p-5 text-center">
                  <span className="material-symbols-outlined text-3xl text-primary-amber/60" aria-hidden="true">
                    waving_hand
                  </span>
                  <p className="mt-2 font-mono text-sm font-semibold text-white">
                    Start the conversation
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Say hello, suggest a public meeting spot, and share your plan with a friend.
                  </p>
                </div>
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
        </section>

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
                aria-label="Message"
                aria-describedby={errors.content?.message ? "message-error" : undefined}
                aria-invalid={Boolean(errors.content)}
                autoComplete="off"
                enterKeyHint="send"
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
              <p id="message-error" className="mt-2 px-2 text-xs text-rose-300" role="alert">
                {errors.content.message}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
