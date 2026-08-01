import { expect, test, type Browser, type Page } from "@playwright/test";

import {
  hasStagingDataConfiguration,
  resetDedicatedE2EData,
} from "./staging-data";

const credentials = [
  { email: process.env.E2E_USER_1_EMAIL, password: process.env.E2E_USER_1_PASSWORD },
  { email: process.env.E2E_USER_2_EMAIL, password: process.env.E2E_USER_2_PASSWORD },
] as const;
const hasStagingCredentials = credentials.every(
  ({ email, password }) => Boolean(email && password),
) && hasStagingDataConfiguration();

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Student Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /ENTER/i }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
}

async function createSignedInPage(
  browser: Browser,
  email: string,
  password: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, email, password);
  return { context, page };
}

async function setReportMockMode(mode: "fail" | "success") {
  const response = await fetch(process.env.E2E_REPORT_CONTROL_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });

  if (!response.ok) {
    throw new Error(`Report mock rejected ${mode} mode with HTTP ${response.status}.`);
  }
}

test.describe("staging two-user flow", () => {
  test.skip(
    !hasStagingCredentials,
    "Dedicated synthetic E2E user credentials are required; no account is created implicitly.",
  );

  test("queue → reveal → chat → message → grading", async ({ browser }) => {
    const first = await createSignedInPage(
      browser,
      credentials[0].email!,
      credentials[0].password!,
    );
    const second = await createSignedInPage(
      browser,
      credentials[1].email!,
      credentials[1].password!,
    );

    try {
      await Promise.all([
        first.page.getByRole("button", { name: "Find a match" }).click(),
        second.page.getByRole("button", { name: "Find a match" }).click(),
      ]);

      await Promise.all([
        expect(first.page.getByText("Seminar Partner Assigned")).toBeVisible({
          timeout: 30_000,
        }),
        expect(second.page.getByText("Seminar Partner Assigned")).toBeVisible({
          timeout: 30_000,
        }),
      ]);

      await Promise.all([
        first.page.getByRole("button", { name: /Enter the Booth/i }).click(),
        second.page.getByRole("button", { name: /Enter the Booth/i }).click(),
      ]);
      await Promise.all([
        expect(first.page.getByLabel("Message")).toBeVisible({ timeout: 20_000 }),
        expect(second.page.getByLabel("Message")).toBeVisible({ timeout: 20_000 }),
      ]);

      const message = `e2e-${Date.now()}`;
      await first.page.getByLabel("Message").fill(message);
      await first.page.getByRole("button", { name: "Send message" }).click();
      await expect(second.page.getByText(message)).toBeVisible({ timeout: 10_000 });

      await Promise.all([
        first.page.getByRole("button", { name: /Go to Grading/i }).click(),
        second.page.getByRole("button", { name: /Go to Grading/i }).click(),
      ]);
      await Promise.all([
        first.page.getByRole("button", { name: "Complete Match" }).click(),
        second.page.getByRole("button", { name: "Complete Match" }).click(),
      ]);
      await Promise.all([
        first.page.getByRole("button", { name: "Grade A" }).click(),
        second.page.getByRole("button", { name: "Grade B" }).click(),
      ]);
      await Promise.all([
        first.page.getByRole("button", { name: /Submit grade A/i }).click(),
        second.page.getByRole("button", { name: /Submit grade B/i }).click(),
      ]);
      await Promise.all([
        expect(first.page).toHaveURL(/\/$/, { timeout: 20_000 }),
        expect(second.page).toHaveURL(/\/$/, { timeout: 20_000 }),
      ]);
    } finally {
      await first.context.close();
      await second.context.close();
    }
  });

  test("report delivery failure can be retried before the match ends", async ({
    browser,
  }) => {
    test.skip(
      !process.env.E2E_REPORT_CONTROL_URL,
      "A staging report mock control URL is required for deterministic failure/success.",
    );
    await resetDedicatedE2EData();
    const first = await createSignedInPage(
      browser,
      credentials[0].email!,
      credentials[0].password!,
    );
    const second = await createSignedInPage(
      browser,
      credentials[1].email!,
      credentials[1].password!,
    );

    try {
      await Promise.all([
        first.page.getByRole("button", { name: "Find a match" }).click(),
        second.page.getByRole("button", { name: "Find a match" }).click(),
      ]);
      await Promise.all([
        first.page.getByText("Seminar Partner Assigned").waitFor({ timeout: 30_000 }),
        second.page.getByText("Seminar Partner Assigned").waitFor({ timeout: 30_000 }),
      ]);
      await Promise.all([
        first.page.getByRole("button", { name: /Enter the Booth/i }).click(),
        second.page.getByRole("button", { name: /Enter the Booth/i }).click(),
      ]);

      await setReportMockMode("fail");
      await first.page.getByRole("button", { name: "Report" }).click();
      await first.page.getByRole("radio", { name: "No-show" }).check();
      await first.page.getByLabel("Details").fill("Synthetic report delivery test.");
      await first.page.getByRole("button", { name: "Submit Report" }).click();
      await expect(first.page.getByRole("alert")).toContainText(/failed|support/i);

      await setReportMockMode("success");
      await first.page.getByRole("button", { name: "Submit Report" }).click();
      await Promise.all([
        expect(first.page).toHaveURL(/\/$/, { timeout: 10_000 }),
        expect(second.page).toHaveURL(/\/$/, { timeout: 12_000 }),
      ]);
    } finally {
      await first.context.close();
      await second.context.close();
      await resetDedicatedE2EData();
    }
  });
});
