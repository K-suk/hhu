import type { Database } from "@/lib/supabase/database.types";

type Message = Database["public"]["Tables"]["messages"]["Row"];

type MessageBubbleProps = {
  message: Message;
  isOwn: boolean;
  /** True while message exists only locally (optimistic) until server ack */
  isPending?: boolean;
};

export function MessageBubble({ message, isOwn, isPending = false }: MessageBubbleProps) {
  const createdAt = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";

  return (
    <div className={`flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
      {!isOwn ? (
        <div className="size-8 shrink-0 rounded-full border border-amber-300/25 bg-[#2a1e16] shadow-lg" />
      ) : null}
      <div className={`flex max-w-[78%] flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn ? (
          <span className="ml-2 text-xs font-medium text-amber-300/70">Partner</span>
        ) : null}
        <div
          className={`relative overflow-hidden rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-lg ${
            isOwn
              ? `rounded-br-sm border border-amber-300/35 bg-[rgba(245,158,11,0.24)] text-amber-50 shadow-[0_0_15px_rgba(245,158,11,0.35),inset_0_0_10px_rgba(251,191,36,0.12)]${isPending ? " opacity-90" : ""}`
              : "rounded-bl-sm border border-[#5d4037] bg-[linear-gradient(180deg,#3d2b20_0%,#2a1e16_100%)] text-slate-200"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
          <p className="relative z-10 whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <p
          className={`text-[11px] font-medium ${
            isOwn ? "mr-1 text-amber-300/70" : "ml-2 text-slate-500"
          }`}
        >
          {isOwn
            ? isPending
              ? "Sending…"
              : `Sent ${createdAt}`
            : createdAt}
        </p>
      </div>
    </div>
  );
}
