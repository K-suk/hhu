import { expect, test, type Page } from "@playwright/test";

function trackUnexpectedBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test.describe("public experience", () => {
  test("login, privacy, and terms render without overflow or console errors", async ({
    page,
  }) => {
    const errors = trackUnexpectedBrowserErrors(page);

    for (const route of ["/login", "/privacy", "/terms"]) {
      await page.goto(route);
      await expect(page.locator("main").last()).toBeVisible();
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows, `${route} must not overflow horizontally`).toBe(false);
    }

    expect(errors).toEqual([]);
  });

  test("registration recovers from university verification failure", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/university-age?domain=student.ubc.ca", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "University eligibility is temporarily unavailable." }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ isKnown: true, minAge: 19 }),
      });
    });

    await page.goto("/login");
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.getByLabel("Student Email").fill("STUDENT@STUDENT.UBC.CA");

    await expect(page.getByText(/could not verify your university domain/i)).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Required age for your university: 19+")).toBeVisible();
    await expect(page.getByLabel("Student Email")).toHaveValue("student@student.ubc.ca");
    expect(attempts).toBe(2);
  });

  test("registration controls are keyboard reachable", async ({ page }) => {
    await page.goto("/login");
    await page.keyboard.press("Tab");

    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).not.toBe("BODY");
    await expect(page.locator(":focus-visible")).toBeVisible();
  });

  test("unknown protected routes recover to sign in", async ({ page }) => {
    await page.goto("/does-not-exist");
    await expect(page).toHaveURL(/\/login\?next=%2Fdoes-not-exist/);
    await expect(page.getByRole("heading", { name: "OPEN" })).toBeVisible();
  });
});
