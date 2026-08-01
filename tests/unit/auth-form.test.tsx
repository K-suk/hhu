import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

vi.mock("@/app/login/actions", () => ({
  loginAction: vi.fn(),
  signUpAction: vi.fn(),
}));

import { AuthForm } from "@/components/auth/auth-form";

function renderForm() {
  return render(
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("registration university checks", () => {
  beforeEach(() => {
    searchParams.delete("mode");
  });

  it("normalizes the email and loads a known university policy", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ isKnown: true, minAge: 19 }));
    renderForm();

    await user.click(screen.getByRole("button", { name: "Sign up" }));
    await user.type(screen.getByLabelText("Student Email"), "STUDENT@STUDENT.UBC.CA");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/university-age?domain=student.ubc.ca",
        expect.objectContaining({ method: "GET", cache: "no-store" }),
      ),
    );
    expect(await screen.findByText("Required age for your university: 19+")).toBeVisible();
    expect(screen.getByLabelText("Student Email")).toHaveValue(
      "student@student.ubc.ca",
    );
  });

  it("shows an outage recovery action and retries successfully", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("network failed"))
      .mockResolvedValueOnce(jsonResponse({ isKnown: true, minAge: 19 }));
    renderForm();

    await user.click(screen.getByRole("button", { name: "Sign up" }));
    await user.type(screen.getByLabelText("Student Email"), "student@student.ubc.ca");

    expect(
      await screen.findByText(/could not verify your university domain/i),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Required age for your university: 19+")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks an underage registration before invoking the action", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ isKnown: true, minAge: 19 }),
    );
    renderForm();

    await user.click(screen.getByRole("button", { name: "Sign up" }));
    await user.type(screen.getByLabelText("Student Email"), "student@student.ubc.ca");
    await screen.findByText("Required age for your university: 19+");
    await user.type(screen.getByLabelText("Birth year"), "2012");
    await user.type(screen.getByLabelText("Birth month"), "01");
    await user.type(screen.getByLabelText("Birth day"), "01");
    await user.type(screen.getByLabelText("Password"), "safe-password");
    await user.click(screen.getByLabelText(/I confirm that I am 19\+/i));
    await user.click(screen.getByRole("button", { name: /ENROLL/i }));

    expect(await screen.findByText(/You must be 19\+ to join HHU/i)).toBeVisible();
  });
});
