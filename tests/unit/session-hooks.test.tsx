import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

type QueryResult = { data: unknown; error: { message: string } | null };
type ClientState = {
  messages: MessageRow[];
  queueRows: Array<{ course_id: string }>;
  matchMaybe: MatchRow | null;
  matchSingle: MatchRow | null;
  ratingMaybe: { grade_point: number } | null;
  partnerProfile: {
    display_name: string | null;
    avatar_url: string | null;
    department: string | null;
  } | null;
  queryError: { message: string } | null;
};

type ChangePayload = { new: unknown };
type ChangeRegistration = {
  event: string;
  table: string;
  callback: (payload: ChangePayload) => void;
};

const mocks = vi.hoisted(() => ({
  activeClient: null as unknown,
  cancelMatchingRequest: vi.fn(),
  enrolInCourseRequest: vi.fn(),
  sendChatMessageRequest: vi.fn(),
  submitMatchReportRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mocks.activeClient,
}));
vi.mock("@/lib/client/matching-service", () => ({
  cancelMatchingRequest: mocks.cancelMatchingRequest,
  enrolInCourseRequest: mocks.enrolInCourseRequest,
}));
vi.mock("@/lib/client/chat-service", () => ({
  sendChatMessageRequest: mocks.sendChatMessageRequest,
  submitMatchReportRequest: mocks.submitMatchReportRequest,
}));

import { useChatSession } from "@/components/chat/use-chat-session";
import {
  COURSES,
  useMatchingSession,
} from "@/components/matching/use-matching-session";

class QueryBuilder {
  constructor(
    private readonly table: string,
    private readonly state: ClientState,
  ) {}

  select() { return this; }
  eq() { return this; }
  or() { return this; }
  in() { return this; }
  order() { return this; }
  limit() { return this; }

  async maybeSingle(): Promise<QueryResult> {
    if (this.state.queryError) {
      return { data: null, error: this.state.queryError };
    }
    if (this.table === "matches") {
      return { data: this.state.matchMaybe, error: null };
    }
    if (this.table === "ratings") {
      return { data: this.state.ratingMaybe, error: null };
    }
    return { data: null, error: null };
  }

  async single(): Promise<QueryResult> {
    return { data: this.state.matchSingle, error: null };
  }

  then(
    onFulfilled: (result: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) {
    const result = this.state.queryError
      ? { data: null, error: this.state.queryError }
      : this.table === "messages"
        ? { data: this.state.messages, error: null }
        : this.table === "queues"
          ? { data: this.state.queueRows, error: null }
          : { data: null, error: null };
    return Promise.resolve(result).then(onFulfilled, onRejected);
  }
}

function createTestClient(overrides: Partial<ClientState> = {}) {
  const state: ClientState = {
    messages: [],
    queueRows: [],
    matchMaybe: null,
    matchSingle: null,
    ratingMaybe: null,
    partnerProfile: null,
    queryError: null,
    ...overrides,
  };
  const registrations: ChangeRegistration[] = [];

  return {
    state,
    from: (table: string) => new QueryBuilder(table, state),
    rpc: () => ({
      maybeSingle: async () => ({ data: state.partnerProfile, error: null }),
    }),
    channel: () => {
      const channel = {
        on: (
          _kind: string,
          filter: { event: string; table: string },
          callback: (payload: ChangePayload) => void,
        ) => {
          registrations.push({
            event: filter.event,
            table: filter.table,
            callback,
          });
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel: vi.fn(async () => undefined),
    emit: (table: string, event: string, payload: ChangePayload) => {
      for (const registration of registrations) {
        if (registration.table === table && registration.event === event) {
          registration.callback(payload);
        }
      }
    },
  };
}

const currentUserId = "10000000-0000-4000-8000-000000000001";
const partnerUserId = "20000000-0000-4000-8000-000000000001";
const matchId = "30000000-0000-4000-8000-000000000001";
const activeMatch: MatchRow = {
  id: matchId,
  user_1: currentUserId,
  user_2: partnerUserId,
  course_id: "beer-101",
  status: "active",
  created_at: "2026-07-31T10:00:00.000Z",
};
type MatchingInput = Parameters<typeof useMatchingSession>[0];

describe("useMatchingSession", () => {
  beforeEach(() => {
    mocks.activeClient = createTestClient();
  });

  function renderMatchingHook(overrides: Partial<MatchingInput> = {}) {
    const markStateRestored = vi.fn();
    const onNavigate = vi.fn();
    const onToast = vi.fn();
    const input = {
      userId: currentUserId,
      genderIdentity: "Non-binary" as const,
      emailDomain: "student.ubc.ca",
      initialProfileStatus: "idle",
      isInitialLoading: false,
      isSessionChecking: false,
      markStateRestored,
      onNavigate,
      onUnauthorized: vi.fn(),
      onToast,
      ...overrides,
    };
    const hook = renderHook(() => useMatchingSession(input));
    return { ...hook, markStateRestored, onNavigate, onToast };
  }

  it("moves from enrolment waiting state back to idle on cancel", async () => {
    mocks.enrolInCourseRequest.mockResolvedValue({
      ok: true,
      data: { matchId: null },
    });
    mocks.cancelMatchingRequest.mockResolvedValue({
      ok: true,
      data: { success: true },
    });
    const { markStateRestored, result } = renderMatchingHook();
    await waitFor(() => expect(markStateRestored).toHaveBeenCalledOnce());

    await act(async () => result.current.enrolCourse(COURSES[0]!));
    expect(mocks.enrolInCourseRequest).toHaveBeenCalledOnce();
    expect(result.current.errorMessage).toBe("");
    expect(result.current.isSearching).toBe(true);
    expect(result.current.activeCourse?.id).toBe("beer-101");

    await act(async () => result.current.cancelSearch());
    expect(result.current.isSearching).toBe(false);
    expect(result.current.activeCourse).toBeNull();
  });

  it("surfaces an enrolment API failure", async () => {
    mocks.enrolInCourseRequest.mockResolvedValue({
      ok: false,
      message: "Matching is temporarily unavailable.",
    });
    const { result } = renderMatchingHook();

    await act(async () => result.current.enrolCourse(COURSES[0]!));

    expect(result.current.errorMessage).toBe("Matching is temporarily unavailable.");
    expect(result.current.isSearching).toBe(false);
  });

  it("recovers a waiting queue after realtime state was missed", async () => {
    mocks.activeClient = createTestClient({ queueRows: [{ course_id: "beer-101" }] });
    const markStateRestored = vi.fn();
    const input = {
      userId: currentUserId,
      genderIdentity: "Non-binary" as const,
      emailDomain: "student.ubc.ca",
      initialProfileStatus: "waiting",
      isInitialLoading: false,
      isSessionChecking: false,
      markStateRestored,
      onNavigate: vi.fn(),
      onUnauthorized: vi.fn(),
      onToast: vi.fn(),
    };
    const { result } = renderHook(() => useMatchingSession(input));

    await waitFor(() => expect(result.current.isSearching).toBe(true));
    expect(result.current.activeCourse?.id).toBe("beer-101");
    expect(markStateRestored).not.toHaveBeenCalled();
  });

  it("routes directly to a recovered ongoing match", async () => {
    mocks.activeClient = createTestClient({ matchMaybe: activeMatch });
    const { onNavigate } = renderMatchingHook();

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith(`/chat/${matchId}`));
  });

  it("reveals an immediate match and retries booth entry", async () => {
    const client = createTestClient({
      matchSingle: activeMatch,
      partnerProfile: {
        display_name: "Partner",
        avatar_url: null,
        department: "Engineering",
      },
    });
    mocks.activeClient = client;
    mocks.enrolInCourseRequest.mockResolvedValue({
      ok: true,
      data: { matchId },
    });
    const { markStateRestored, onNavigate, result } = renderMatchingHook();
    await waitFor(() => expect(markStateRestored).toHaveBeenCalledOnce());

    await act(async () => result.current.enrolCourse(COURSES[0]!));
    expect(result.current.revealState).toMatchObject({
      matchId,
      partner: { display_name: "Partner" },
    });

    client.state.matchMaybe = activeMatch;
    await act(async () => result.current.enterBooth(matchId));
    expect(onNavigate).toHaveBeenCalledWith(`/chat/${matchId}`);
  });

  it("keeps search state recoverable when cancellation is rejected", async () => {
    mocks.activeClient = createTestClient({ queueRows: [{ course_id: "beer-101" }] });
    mocks.cancelMatchingRequest.mockResolvedValue({
      ok: false,
      message: "Cancellation failed.",
    });
    const { onToast, result } = renderMatchingHook();
    await waitFor(() => expect(result.current.isSearching).toBe(true));

    await act(async () => result.current.cancelSearch());

    expect(result.current.errorMessage).toBe("Cancellation failed.");
    expect(onToast).toHaveBeenCalledWith("Cancellation failed.", "error");
  });

  it("responds to realtime queue and match events", async () => {
    const client = createTestClient({
      partnerProfile: {
        display_name: "Realtime Partner",
        avatar_url: null,
        department: "Arts",
      },
    });
    mocks.activeClient = client;
    const { markStateRestored, result } = renderMatchingHook();
    await waitFor(() => expect(markStateRestored).toHaveBeenCalledOnce());

    act(() => {
      client.emit("profiles", "UPDATE", {
        new: { status: "waiting" },
      });
    });
    expect(result.current.isSearching).toBe(true);

    act(() => {
      client.emit("matches", "INSERT", { new: activeMatch });
    });
    await waitFor(() =>
      expect(result.current.revealState?.partner.display_name).toBe(
        "Realtime Partner",
      ),
    );
    expect(result.current.isSearching).toBe(false);
  });

  it("falls back to waiting when a matched profile update arrives before the row", async () => {
    const client = createTestClient();
    mocks.activeClient = client;
    const { markStateRestored, result } = renderMatchingHook();
    await waitFor(() => expect(markStateRestored).toHaveBeenCalledOnce());

    act(() => {
      client.emit("profiles", "UPDATE", {
        new: { status: "matched" },
      });
    });

    await waitFor(() => expect(result.current.isSearching).toBe(true));
    expect(result.current.activeCourse?.id).toBe("queue-recovery");
  });

  it("handles missing profile data, network failure, and booth query errors", async () => {
    const { markStateRestored, onToast, result } = renderMatchingHook({
      genderIdentity: null,
    });
    await waitFor(() => expect(markStateRestored).toHaveBeenCalledOnce());
    await act(async () => result.current.enrolCourse(COURSES[0]!));
    expect(result.current.errorMessage).toMatch(/gender identity is missing/i);

    mocks.enrolInCourseRequest.mockRejectedValue(new TypeError("offline"));
    const networkHook = renderMatchingHook();
    await waitFor(() =>
      expect(networkHook.markStateRestored).toHaveBeenCalledOnce(),
    );
    await act(async () => networkHook.result.current.enrolCourse(COURSES[0]!));
    expect(networkHook.result.current.errorMessage).toMatch(/couldn't reach/i);

    const client = createTestClient({ queryError: { message: "database timeout" } });
    mocks.activeClient = client;
    const boothHook = renderMatchingHook();
    await waitFor(() => expect(boothHook.markStateRestored).toHaveBeenCalledOnce());
    await act(async () => boothHook.result.current.enterBooth(matchId));
    expect(boothHook.result.current.errorMessage).toBe("Network issue detected. Please try again.");
    expect(boothHook.onToast).toHaveBeenCalledWith(
      "Network issue detected. Please try again.",
      "error",
    );
    expect(onToast).not.toHaveBeenCalled();
  });

  it("navigates when an immediate match response precedes row visibility", async () => {
    mocks.enrolInCourseRequest.mockResolvedValue({
      ok: true,
      data: { matchId },
    });
    const { markStateRestored, onNavigate, result } = renderMatchingHook();
    await waitFor(() => expect(markStateRestored).toHaveBeenCalledOnce());

    await act(async () => result.current.enrolCourse(COURSES[0]!));

    expect(onNavigate).toHaveBeenCalledWith(`/chat/${matchId}`);
  });
});

describe("useChatSession", () => {
  beforeEach(() => {
    mocks.activeClient = createTestClient({ matchMaybe: activeMatch });
  });

  function renderChatHook() {
    const onUnauthorized = vi.fn();
    return renderHook(() =>
      useChatSession({
        currentUserId,
        match: activeMatch,
        initialMessages: [],
        onUnauthorized,
      }),
    );
  }

  it("replaces an optimistic message with the validated server message", async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    mocks.sendChatMessageRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const { result } = renderChatHook();
    await waitFor(() => expect(result.current.isLoadingMessages).toBe(false));

    let request: Promise<boolean> | undefined;
    act(() => {
      request = result.current.sendMessage("hello");
    });
    await waitFor(() => expect(result.current.messages[0]?.id).toMatch(/^pending:/));

    resolveRequest({
      ok: true,
      data: {
        message: {
          id: "40000000-0000-4000-8000-000000000001",
          match_id: matchId,
          sender_id: currentUserId,
          content: "hello",
          created_at: "2026-07-31T10:00:01.000Z",
        },
      },
    });
    await act(async () => expect(await request).toBe(true));

    expect(result.current.messages.map(({ id }) => id)).toEqual([
      "40000000-0000-4000-8000-000000000001",
    ]);
  });

  it("rolls back a failed optimistic send and exposes report failure state", async () => {
    mocks.sendChatMessageRequest.mockResolvedValue({
      ok: false,
      message: "Message failed.",
    });
    mocks.submitMatchReportRequest.mockResolvedValue({
      ok: false,
      message: "Report failed.",
    });
    const { result } = renderChatHook();

    await act(async () => {
      expect(await result.current.sendMessage("hello")).toBe(false);
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.errorMessage).toBe("Message failed.");

    await act(async () => {
      expect(
        await result.current.submitReport({ category: "Other", details: "details" }),
      ).toBe(false);
    });
    expect(result.current.reportErrorMessage).toBe("Report failed.");
  });

  it("merges realtime messages and locks when the partner finishes", async () => {
    const client = createTestClient({ matchMaybe: activeMatch });
    mocks.activeClient = client;
    const { result } = renderChatHook();
    await waitFor(() => expect(result.current.isLoadingMessages).toBe(false));

    act(() => {
      client.emit("messages", "INSERT", {
        new: {
          id: "50000000-0000-4000-8000-000000000001",
          match_id: matchId,
          sender_id: partnerUserId,
          content: "realtime hello",
          created_at: "2026-07-31T10:00:02.000Z",
        },
      });
      client.emit("matches", "UPDATE", {
        new: { ...activeMatch, status: "finished" },
      });
    });

    expect(result.current.messages[0]?.content).toBe("realtime hello");
    expect(result.current.isChatLocked).toBe(true);
    expect(result.current.partnerGradeAlert).toMatch(/Time to grade/);
  });

  it("submits a report successfully and can clear prior report errors", async () => {
    mocks.submitMatchReportRequest
      .mockResolvedValueOnce({ ok: false, message: "Try again." })
      .mockResolvedValueOnce({ ok: true, data: { success: true } });
    const { result } = renderChatHook();

    await act(async () => {
      await result.current.submitReport({ category: "Other", details: "details" });
    });
    expect(result.current.reportErrorMessage).toBe("Try again.");
    act(() => result.current.clearReportError());
    expect(result.current.reportErrorMessage).toBe("");

    await act(async () =>
      expect(
        await result.current.submitReport({ category: "No-show", details: "details" }),
      ).toBe(true),
    );
  });

  it("loads partner, history, and an existing partner grade", async () => {
    const historicalMessage: MessageRow = {
      id: "60000000-0000-4000-8000-000000000001",
      match_id: matchId,
      sender_id: partnerUserId,
      content: "history",
      created_at: "2026-07-31T09:59:00.000Z",
    };
    mocks.activeClient = createTestClient({
      matchMaybe: activeMatch,
      messages: [historicalMessage],
      ratingMaybe: { grade_point: 4.33 },
      partnerProfile: {
        display_name: "Partner",
        avatar_url: "https://example.test/avatar.jpg",
        department: "Science",
      },
    });
    const { result } = renderChatHook();

    await waitFor(() => expect(result.current.isLoadingMessages).toBe(false));
    await waitFor(() => expect(result.current.partnerProfile?.display_name).toBe("Partner"));
    expect(result.current.messages).toEqual([historicalMessage]);
    expect(result.current.isChatLocked).toBe(true);
    expect(result.current.partnerGradeAlert).toContain("4.33");
  });

  it("handles rating, deletion, and reported realtime transitions", async () => {
    const client = createTestClient({ matchMaybe: activeMatch });
    mocks.activeClient = client;
    const { result } = renderChatHook();
    await waitFor(() => expect(result.current.isLoadingMessages).toBe(false));

    act(() => {
      client.emit("ratings", "INSERT", {
        new: {
          id: "70000000-0000-4000-8000-000000000001",
          match_id: matchId,
          rater_user_id: partnerUserId,
          rated_user_id: currentUserId,
          grade_point: 4,
          created_at: "2026-07-31T10:02:00.000Z",
        },
      });
    });
    expect(result.current.matchStatus).toBe("graded");
    expect(result.current.partnerGradeAlert).toContain("4.00");

    act(() => {
      client.emit("matches", "DELETE", { new: {} });
    });
    expect(result.current.matchStatus).toBe("finished");

    act(() => {
      client.emit("matches", "UPDATE", {
        new: { ...activeMatch, status: "reported" },
      });
    });
    expect(result.current.isReported).toBe(true);
    expect(result.current.showBeingReportedAsTargetModal).toBe(true);
    act(() => result.current.acknowledgeReported());
    expect(result.current.showBeingReportedAsTargetModal).toBe(false);
  });

  it("rejects invalid content and recovers from send/report network failures", async () => {
    mocks.sendChatMessageRequest.mockRejectedValue(new TypeError("offline"));
    mocks.submitMatchReportRequest.mockRejectedValue(new TypeError("offline"));
    const { result } = renderChatHook();

    await act(async () => expect(await result.current.sendMessage("   ")).toBe(false));
    expect(mocks.sendChatMessageRequest).not.toHaveBeenCalled();

    await act(async () => expect(await result.current.sendMessage("hello")).toBe(false));
    expect(result.current.errorMessage).toBe("Network issue detected. Please try again.");
    expect(result.current.messages).toEqual([]);

    await act(async () =>
      expect(
        await result.current.submitReport({ category: "Other", details: "details" }),
      ).toBe(false),
    );
    expect(result.current.reportErrorMessage).toMatch(/couldn't reach the reporting service/i);
  });

  it("keeps successful sends without a returned message payload", async () => {
    mocks.sendChatMessageRequest.mockResolvedValue({ ok: true, data: {} });
    const { result } = renderChatHook();

    await act(async () => expect(await result.current.sendMessage("hello")).toBe(true));

    expect(result.current.messages).toEqual([]);
  });
});
