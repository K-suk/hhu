import { describe, expect, it } from "vitest";

import {
  isMatchEndedStatus,
  mergeMessages,
  type ChatMessage,
} from "@/components/chat/use-chat-session";
import { getCourseById } from "@/components/matching/use-matching-session";

function message(id: string, createdAt: string | null, content = id): ChatMessage {
  return {
    id,
    match_id: "match-1",
    sender_id: "user-1",
    content,
    created_at: createdAt,
  };
}

describe("chat session helpers", () => {
  it("deduplicates realtime and polling messages and orders them deterministically", () => {
    const merged = mergeMessages(
      [message("b", "2026-07-31T10:00:01.000Z"), message("a", null, "old")],
      [message("a", null, "new"), message("c", "2026-07-31T10:00:01.000Z")],
    );

    expect(merged.map(({ id }) => id)).toEqual(["a", "b", "c"]);
    expect(merged[0]?.content).toBe("new");
  });

  it("locks every terminal match status", () => {
    expect(isMatchEndedStatus("active")).toBe(false);
    for (const status of ["reported", "finished", "graded", "expired"]) {
      expect(isMatchEndedStatus(status)).toBe(true);
    }
  });
});

describe("matching session helpers", () => {
  it("recovers a known course and safely represents an unknown queue course", () => {
    expect(getCourseById("beer-101")?.label).toBe("BEER 101");
    expect(getCourseById("chem-404")).toMatchObject({
      id: "chem-404",
      label: "CHEM-404",
      imageUrl: null,
    });
    expect(getCourseById(null)).toBeNull();
  });
});
