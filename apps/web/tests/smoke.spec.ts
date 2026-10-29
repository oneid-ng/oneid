import { test, expect } from "@playwright/test";

test.describe("Citizen Smoke Tests", () => {
  test("Welcome page displays ONEiD branding and demo notices", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ONEiD/);
    await expect(page.getByText("ONEiD")).toBeVisible();
    await expect(page.getByText("DEMO ENVIRONMENT")).toBeVisible();
  });

  test("Consent screen shows requester and mandatory withdrawal notice", async ({
    page,
  }) => {
    await page.goto("/consent/demo");
    await expect(page.getByText("Authorisation Request")).toBeVisible();
    await expect(page.getByText("IMPORTANT CONSENT NOTICE:")).toBeVisible();
    await expect(
      page.getByText(
        "Withdrawing consent affects FUTURE sharing only; it does not erase data already received by another institution.",
      ),
    ).toBeVisible();
  });
});
