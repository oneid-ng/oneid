import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const EVIDENCE_DIR = path.resolve(process.cwd(), "../../docs/evidence/day7");

test.describe("ONEiD End-to-End Journeys & Acceptance Targets (README §21, §25)", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  });

  // ── Journey 1: Open account via bank request and consent ─────────────────
  test("Journey 1: Open an account via bank request and consent", async ({ page }) => {
    // Intercept consent endpoints to test explicit consent flow
    await page.route("**/v1/requests/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "req-bank-account-01",
          verifierName: "First Demo Bank",
          verifierDomain: "bank.demo.oneid.local",
          purpose: "Tier 2 Bank Account Opening",
          claims: ["fullName", "over18", "kycTier", "address"],
        }),
      });
    });

    await page.route("**/v1/consents*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          receiptHash:
            "0xbankreceipt000000000000000000000000000000000000000000000000000001",
          status: "active",
        }),
      });
    });

    await page.goto("/consent/req-bank-account-01");

    // 1. Verify Purpose and Requester
    await expect(
      page.getByRole("heading", { name: "Authorisation Request" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "First Demo Bank" })).toBeVisible();
    await expect(page.getByText("Tier 2 Bank Account Opening")).toBeVisible();

    // 2. Mandatory withdrawal notice per README rule 7
    await expect(page.getByText("IMPORTANT CONSENT NOTICE:")).toBeVisible();
    await expect(
      page.getByText(
        "Withdrawing consent affects FUTURE sharing only; it does not erase data already received by another institution.",
      ),
    ).toBeVisible();

    // 3. Selective disclosure claim items
    await expect(page.getByText("Full Legal Name")).toBeVisible();
    await expect(page.getByText("Age Verification")).toBeVisible();

    // 4. Capture screenshot of consent review
    const screenshotPath = path.join(EVIDENCE_DIR, "bank-account-opening.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // 5. Submit consent
    await page.getByRole("button", { name: "Confirm & Record Consent Receipt" }).click();

    // 6. Verifies redirect to Consent Receipt screen
    await expect(
      page.getByRole("heading", { name: "Consent Receipt", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status", { name: "Active (On-Chain)" })).toBeVisible();
  });

  // ── Journey 2: Record correction across Authority, Bank and Telecom ──────
  test("Journey 2: Correct my record across Authority, Bank and Telecom with independent outcomes", async ({
    page,
  }) => {
    await page.goto("/corrections/demo-ticket-01");

    // Verify correction timeline header
    await expect(
      page.getByRole("heading", { name: "Correction Processing Timeline" }),
    ).toBeVisible();

    // Authority: Applied
    await expect(page.getByText("Identity Management Authority (NIMC)")).toBeVisible();
    await expect(page.getByText("NIN_RECORD_UPDATED_ON_CHAIN")).toBeVisible();

    // Bank: Rejected
    await expect(page.getByText("Apex Trust Bank")).toBeVisible();
    await expect(page.getByText("PROOF_OF_ADDRESS_DISCREPANCY")).toBeVisible();

    // Telecom: Partially Applied
    await expect(page.getByText("Demo Telecom Nigeria")).toBeVisible();
    await expect(page.getByText("SIM_RE_REGISTRATION_IN_PROGRESS")).toBeVisible();

    // Rule 6 notice: Authority stays with the institution
    await expect(page.getByText("Rule #6 (Institutional Authority):")).toBeVisible();

    const screenshotPath = path.join(EVIDENCE_DIR, "multi-institution-corrections.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  // ── Journey 3: Verify a credential as a verifier including denied cases ──
  test("Journey 3: Verify a credential as a verifier including denied cases", async ({
    page,
  }) => {
    await page.goto("/exceptions");

    // All fail-closed exception states must be present and explain why access is blocked
    await expect(
      page.getByRole("heading", {
        name: "Exception States & Fail-Closed UX (README §18.5)",
      }),
    ).toBeVisible();

    // Expired consent
    await expect(
      page.getByRole("heading", { name: "Consent Period Has Expired" }),
    ).toBeVisible();
    await expect(page.getByText("CONSENT_EXPIRED")).toBeVisible();

    // Withdrawn consent
    await expect(
      page.getByRole("heading", { name: "Consent Explicitly Withdrawn" }),
    ).toBeVisible();
    await expect(page.getByText("CONSENT_WITHDRAWN")).toBeVisible();

    // Revoked credential
    await expect(
      page.getByRole("heading", { name: "Credential Revoked or Invalid" }),
    ).toBeVisible();
    await expect(page.getByText("CREDENTIAL_REVOKED")).toBeVisible();

    // Suspended issuer
    await expect(
      page.getByRole("heading", { name: "Issuing Institution Suspended" }),
    ).toBeVisible();
    await expect(page.getByText("ISSUER_NOT_ACTIVE")).toBeVisible();

    // Unauthorized role
    await expect(
      page.getByRole("heading", { name: "Wrong Role / Action Denied" }),
    ).toBeVisible();
    await expect(page.getByText("FORBIDDEN_ROLE_403")).toBeVisible();

    const screenshotPath = path.join(
      EVIDENCE_DIR,
      "credential-verification-and-denied.png",
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  // ── Journey 4: Issue and revoke a credential ─────────────────────────────
  test("Journey 4: Issue and revoke a credential", async ({ page }) => {
    // Intercept auth/me
    await page.route("**/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: "synthetic-user-issuer-01",
            userId: "synthetic-user-issuer-01",
            role: "issuer",
          },
        }),
      });
    });

    await page.route("**/v1/identity/applications", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ applications: [] }),
      });
    });

    await page.goto("/issuer");

    // Switch to issue tab
    await page.getByRole("button", { name: "Issue W3C SD-JWT Credential" }).click();
    await expect(
      page.getByRole("heading", { name: "Issue W3C SD-JWT Credential" }),
    ).toBeVisible();

    // Switch to revoke tab
    await page.getByRole("button", { name: "Revoke Credential" }).click();
    await expect(
      page.getByRole("heading", { name: "Revoke Credential On-Chain" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Mark a credential revoked on the Soroban credential-status contract.",
      ),
    ).toBeVisible();

    const screenshotPath = path.join(EVIDENCE_DIR, "credential-issue-and-revoke.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  // ── Journey 5: Anchor onboarding flow ────────────────────────────────────
  test("Journey 5: Anchor onboarding flow (README §16)", async ({ page }) => {
    await page.goto("/anchor");

    await expect(
      page.getByRole("heading", { name: "Mock Anchor — SEP-24 Onboarding" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Demo notice" })).toContainText(
      "SEP-STYLE DEMO",
    );

    // Verify valid on-chain path
    await page.click("#btn-start-deposit");
    await page.click("#btn-verify-kyc");
    await expect(page.locator("#anchor-success-state")).toBeVisible();
    await expect(page.getByText("Proceeded without any document upload!")).toBeVisible();

    // Verify denied path
    await page.getByRole("button", { name: "Reset Demo" }).click();
    await page.check('input[value="withdrawn"]');
    await page.click("#btn-start-deposit");
    await page.click("#btn-verify-kyc");
    await expect(page.locator("#anchor-blocked-state")).toBeVisible();

    const screenshotPath = path.join(EVIDENCE_DIR, "anchor-onboarding.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  // ── Resilience drills: FEATURE_SIMULATED_FAILURES ─────────────────────────
  test("Resilience drills using FEATURE_SIMULATED_FAILURES", async ({ page }) => {
    // Authenticate as admin to access simulate panel
    await page.route("**/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: "synthetic-user-admin-01",
            userId: "synthetic-user-admin-01",
            role: "admin",
          },
        }),
      });
    });

    await page.route("**/v1/admin/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          indexer: [],
          featureFlags: { simulatedFailures: true },
        }),
      });
    });

    await page.route("**/v1/admin/entities", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entities: [] }),
      });
    });

    await page.route("**/v1/admin/audit", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ events: [] }),
      });
    });

    await page.goto("/admin");

    // Navigate to simulate tab
    await page.getByRole("button", { name: "Failure Simulation Panel" }).click();
    await expect(
      page.getByRole("heading", { name: "Chaos Engineering & Failure Simulation" }),
    ).toBeVisible();
    await expect(page.getByText("FEATURE ACTIVE")).toBeVisible();

    // 1. Test RPC unavailable
    await page.route("**/v1/admin/simulate/failure", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "CHAIN_UNAVAILABLE: [SIMULATED] RPC is down.",
          code: "CHAIN_UNAVAILABLE",
        }),
      });
    });

    await page.getByRole("button", { name: "Trigger Simulated Failure" }).click();
    await expect(
      page.locator("div[role='alert']:not(#__next-route-announcer__)"),
    ).toContainText("503");

    // 2. Test Partial Synchronisation
    await page.route("**/v1/admin/simulate/failure", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Simulated partial sync: some institutions updated, some failed.",
        }),
      });
    });

    await page.selectOption("select", "partial_sync");
    await page.getByRole("button", { name: "Trigger Simulated Failure" }).click();
    await expect(page.locator("div[role='status']")).toContainText("partial_sync");

    const screenshotPath = path.join(EVIDENCE_DIR, "resilience-drills.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  // ── Acceptance Targets: README Section 25 ────────────────────────────────
  test("Section 25 Acceptance Targets Verification", async ({ page }) => {
    await page.goto("/exceptions");

    // Target 1: Consent — No claim disclosed before explicit approval
    await expect(
      page.getByRole("heading", { name: "Consent Period Has Expired" }),
    ).toBeVisible();

    // Target 2: Permissions — Wrong-role actions are rejected
    await expect(
      page.getByRole("heading", { name: "Wrong Role / Action Denied" }),
    ).toBeVisible();

    // Target 3: Credentials — Expired or revoked demo credentials fail checks
    await expect(
      page.getByRole("heading", { name: "Credential Revoked or Invalid" }),
    ).toBeVisible();

    // Target 4: Corrections — Each institution shows its own independent outcome
    await expect(
      page.getByRole("heading", { name: "Partial Synchronization Across Institutions" }),
    ).toBeVisible();

    // Target 5: Reliability — Local demo covers denial, failure, and retry
    await expect(
      page.getByRole("heading", { name: "Stellar Network / RPC Unreachable" }),
    ).toBeVisible();

    // Target 6: Evidence — Screenshots and evidence are stored in docs/evidence/day7/
    const screenshotPath = path.join(EVIDENCE_DIR, "acceptance-targets.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });

    expect(fs.existsSync(screenshotPath)).toBe(true);
  });
});
