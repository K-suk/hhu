import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, rpc } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  return {
    rpc: rpcMock,
    createClient: vi.fn(async () => ({ rpc: rpcMock })),
  };
});

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "@/app/api/university-age/route";

describe("GET /api/university-age", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("rejects an invalid domain", async () => {
    const response = await GET(
      new Request("http://localhost/api/university-age?domain=not%20a%20domain"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ message: "Bad Request" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns a known university policy", async () => {
    rpc.mockResolvedValue({
      data: [{ is_known: true, min_age: 19 }],
      error: null,
    });

    const response = await GET(
      new Request("http://localhost/api/university-age?domain=student.ubc.ca"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ isKnown: true, minAge: 19 });
    expect(rpc).toHaveBeenCalledWith("get_domain_min_age", {
      p_email_domain: "student.ubc.ca",
    });
  });

  it("falls back for an unknown university", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    const response = await GET(
      new Request("http://localhost/api/university-age?domain=students.example.edu"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ isKnown: false });
  });

  it("returns 503 when the eligibility RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });

    const response = await GET(
      new Request("http://localhost/api/university-age?domain=student.ubc.ca"),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "University eligibility is temporarily unavailable.",
    });
  });
});
