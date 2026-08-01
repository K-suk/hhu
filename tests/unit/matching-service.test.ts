import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCsrfToken } = vi.hoisted(() => ({ getCsrfToken: vi.fn() }));

vi.mock("@/lib/security/csrf-client", () => ({ getCsrfToken }));

import {
  cancelMatchingRequest,
  enrolInCourseRequest,
} from "@/lib/client/matching-service";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const enrolInput = {
  payload: {
    p_course_id: "beer-101",
    p_gender_identity: "Non-binary" as const,
    p_email_domain: "student.ubc.ca",
  },
  onUnauthorized: vi.fn(),
};

describe("matching service", () => {
  beforeEach(() => {
    getCsrfToken.mockResolvedValue("csrf-token");
  });

  it("returns immediate and waiting enrolment results", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ matchId: "match-1" }))
      .mockResolvedValueOnce(jsonResponse({}));

    await expect(enrolInCourseRequest(enrolInput)).resolves.toEqual({
      ok: true,
      data: { matchId: "match-1" },
    });
    await expect(enrolInCourseRequest(enrolInput)).resolves.toEqual({
      ok: true,
      data: { matchId: null },
    });
  });

  it("rejects malformed enrolment success responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ matchId: 42 }));

    await expect(enrolInCourseRequest(enrolInput)).resolves.toEqual({
      ok: false,
      message: "The matching service returned an invalid response. Please try again.",
    });
  });

  it("returns API errors and handles unauthorized enrolment", async () => {
    const onUnauthorized = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Unauthorized" }, 401),
    );

    await expect(
      enrolInCourseRequest({ ...enrolInput, onUnauthorized }),
    ).resolves.toEqual({
      ok: false,
      message: "Your session expired. Please sign in again.",
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("validates successful cancellation", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: false }));

    await expect(cancelMatchingRequest({ onUnauthorized: vi.fn() })).resolves.toEqual({
      ok: true,
      data: { success: true },
    });
    await expect(cancelMatchingRequest({ onUnauthorized: vi.fn() })).resolves.toEqual({
      ok: false,
      message: "The matching service returned an invalid response. Please try again.",
    });
  });

  it("returns cancellation API errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "Failed to cancel search." }, 500),
    );

    await expect(cancelMatchingRequest({ onUnauthorized: vi.fn() })).resolves.toEqual({
      ok: false,
      message: "Failed to cancel search.",
    });
  });
});
