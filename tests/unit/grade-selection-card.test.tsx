import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCsrfToken, push, refresh, replace, showToast } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  showToast: vi.fn(),
  getCsrfToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
}));
vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast }),
}));
vi.mock("@/lib/security/csrf-client", () => ({ getCsrfToken }));

import { GradeSelectionCard } from "@/components/grading/grade-selection-card";

function renderCard() {
  return render(
    <GradeSelectionCard
      matchId="10000000-0000-4000-8000-000000000001"
      courseLabel="BEER 101"
      ratedUserId="20000000-0000-4000-8000-000000000001"
    />,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("grading", () => {
  beforeEach(() => {
    getCsrfToken.mockResolvedValue("csrf-token");
  });

  it("requires a grade and prevents a duplicate submission", async () => {
    const user = userEvent.setup();
    let resolveRequest: (response: Response) => void = () => undefined;
    const pendingRequest = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(pendingRequest);
    renderCard();

    expect(screen.getByRole("button", { name: /select a grade to continue/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Grade A" }));
    const submit = screen.getByRole("button", { name: /submit grade a/i });
    await user.dblClick(submit);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(submit).toBeDisabled();
    resolveRequest(jsonResponse({ success: true }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(showToast).toHaveBeenCalledWith("Grade A submitted.", "success");
  });

  it.each([
    [401, "Your session expired. Please sign in again."],
    [403, "Permission denied for that action."],
    [500, "Could not save grade."],
  ])("shows a recoverable %s response", async (status, expected) => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: status === 500 ? expected : "Request failed" }, status),
    );
    renderCard();

    await user.click(screen.getByRole("button", { name: "Grade B" }));
    await user.click(screen.getByRole("button", { name: /submit grade b/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    if (status === 401) expect(push).toHaveBeenCalledWith("/login");
  });

  it("allows retry after a network failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
    renderCard();

    await user.click(screen.getByRole("button", { name: "Grade C" }));
    await user.click(screen.getByRole("button", { name: /submit grade c/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't reach the grading service. Check your connection and try again.",
    );
    expect(screen.getByRole("button", { name: /submit grade c/i })).toBeEnabled();
  });
});
