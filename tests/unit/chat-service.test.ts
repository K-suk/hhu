import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCsrfToken } = vi.hoisted(() => ({ getCsrfToken: vi.fn() }));

vi.mock("@/lib/security/csrf-client", () => ({ getCsrfToken }));

import {
  sendChatMessageRequest,
  submitMatchReportRequest,
} from "@/lib/client/chat-service";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("chat service", () => {
  beforeEach(() => {
    getCsrfToken.mockResolvedValue("csrf-token");
  });

  it("validates and returns a sent message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        message: {
          id: "message-1",
          match_id: "match-1",
          sender_id: "user-1",
          content: "hello",
          created_at: "2026-07-31T10:00:00.000Z",
        },
      }),
    );

    const result = await sendChatMessageRequest({
      matchId: "match-1",
      content: "hello",
      onUnauthorized: vi.fn(),
    });

    expect(result).toMatchObject({ ok: true, data: { message: { id: "message-1" } } });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-csrf-token": "csrf-token" }),
      }),
    );
  });

  it("rejects malformed success payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ message: { id: 123 } }));

    const result = await sendChatMessageRequest({
      matchId: "match-1",
      content: "hello",
      onUnauthorized: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      message: "Failed to read server response. Please try again.",
    });
  });

  it("surfaces a protected error and invokes unauthorized recovery", async () => {
    const onUnauthorized = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Unauthorized" }, 401),
    );

    const result = await sendChatMessageRequest({
      matchId: "match-1",
      content: "hello",
      onUnauthorized,
    });

    expect(result).toEqual({ ok: false, message: "Your session expired. Please sign in again." });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("submits a valid report and rejects an invalid report response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: false }));

    const input = {
      matchId: "match-1",
      report: { category: "No-show" as const, details: "Did not arrive." },
      onUnauthorized: vi.fn(),
    };

    await expect(submitMatchReportRequest(input)).resolves.toEqual({
      ok: true,
      data: { success: true },
    });
    await expect(submitMatchReportRequest(input)).resolves.toEqual({
      ok: false,
      message: "The reporting service returned an invalid response. Please try again.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the report endpoint error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Report submission failed. Please contact support." }, 502),
    );

    await expect(
      submitMatchReportRequest({
        matchId: "match-1",
        report: { category: "Other", details: "Details" },
        onUnauthorized: vi.fn(),
      }),
    ).resolves.toEqual({
      ok: false,
      message: "Report submission failed. Please contact support.",
    });
  });
});
