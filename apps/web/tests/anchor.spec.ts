import { test, expect } from "@playwright/test";

test.describe("Anchor Onboarding Flow (README §16, §21)", () => {
  test("proceeds without document upload when consent and credential are valid", async ({
    page,
  }) => {
    await page.goto("/anchor");
    await expect(page.getByText("Mock Anchor — SEP-24 Onboarding")).toBeVisible();
    await expect(page.getByText("SEP-style demo")).toBeVisible();

    // Start deposit
    await page.click("#btn-start-deposit");

    // KYC check screen
    await expect(page.getByText("SEP-12 Reusable KYC Verification")).toBeVisible();
    await page.click("#btn-verify-kyc");

    // Success screen
    await expect(page.locator("#anchor-success-state")).toBeVisible();
    await expect(page.getByText("Proceeded without any document upload!")).toBeVisible();
    await expect(page.getByText("Active Issuer: Verified")).toBeVisible();
    await expect(page.getByText("Active Credential: Verified")).toBeVisible();
    await expect(page.getByText("Active Consent: Verified")).toBeVisible();
  });

  test("is blocked with visible reason when consent is withdrawn", async ({ page }) => {
    await page.goto("/anchor");
    await page.check('input[value="withdrawn"]');
    await page.click("#btn-start-deposit");
    await page.click("#btn-verify-kyc");

    // Blocked screen
    await expect(page.locator("#anchor-blocked-state")).toBeVisible();
    await expect(page.getByText("Onboarding Blocked (Fail Closed)")).toBeVisible();
    await expect(page.locator("#anchor-error-reason")).toContainText(
      "Consent receipt has been withdrawn",
    );
  });

  test("is blocked with visible reason when credential is revoked", async ({ page }) => {
    await page.goto("/anchor");
    await page.check('input[value="revoked"]');
    await page.click("#btn-start-deposit");
    await page.click("#btn-verify-kyc");

    // Blocked screen
    await expect(page.locator("#anchor-blocked-state")).toBeVisible();
    await expect(page.getByText("Onboarding Blocked (Fail Closed)")).toBeVisible();
    await expect(page.locator("#anchor-error-reason")).toContainText(
      "Credential has been revoked",
    );
  });
});
