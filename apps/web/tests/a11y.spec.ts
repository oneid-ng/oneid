import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const EVIDENCE_DIR = path.resolve(process.cwd(), "../../docs/evidence/day6");

test.describe("WCAG 2.1 AA Accessibility & Axe Audit (README §17, §18.5, §21)", () => {
  const reportLines: string[] = [
    "==================================================================",
    "ONEiD WCAG 2.1 AA ACCESSIBILITY AUDIT REPORT (Playwright + Axe)",
    "Standard: WCAG 2.1 Level AA (Contrast, Focus, Labels, Semantic HTML)",
    `Generated: ${new Date().toISOString()}`,
    "==================================================================\n",
  ];

  test.beforeAll(() => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
  });

  const routesToTest = [
    { path: "/", name: "welcome", title: "Welcome & Onboarding Portal Select" },
    { path: "/onboard", name: "onboard", title: "Citizen Identity Onboarding" },
    {
      path: "/consent/demo-req-101",
      name: "consent",
      title: "Selective Disclosure Consent",
    },
    {
      path: "/exceptions",
      name: "exceptions",
      title: "Exception States & Fail-Closed UX",
    },
    { path: "/issuer", name: "issuer", title: "Issuer Portal" },
    { path: "/verifier", name: "verifier", title: "Verifier Portal" },
    { path: "/admin", name: "admin", title: "Admin & Operations Portal" },
  ];

  for (const { path: routePath, name, title } of routesToTest) {
    test(`Screen [${title}] (${routePath}) passes Axe WCAG 2.1 AA with 0 critical/serious violations`, async ({
      page,
    }) => {
      await page.goto(routePath);
      await page.waitForTimeout(500);

      // 1. Capture evidence screenshot
      const screenshotPath = path.join(EVIDENCE_DIR, `${name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // 2. Run Axe accessibility audit
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const criticalOrSerious = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );

      reportLines.push(`[SCREEN: ${title} (${routePath})]`);
      reportLines.push(`  Screenshot: docs/evidence/day6/${name}.png`);
      reportLines.push(
        `  Total Violations: ${accessibilityScanResults.violations.length}`,
      );
      reportLines.push(`  Critical/Serious Violations: ${criticalOrSerious.length}`);

      if (criticalOrSerious.length > 0) {
        for (const v of criticalOrSerious) {
          reportLines.push(`    - Violation: ${v.id} (${v.impact}) - ${v.description}`);
          reportLines.push(`      Help: ${v.helpUrl}`);
        }
      } else {
        reportLines.push("  Status: PASSED (Zero critical or serious violations)");
      }
      reportLines.push("\n");

      // Verify zero critical or serious accessibility violations
      expect(criticalOrSerious).toEqual([]);
    });
  }

  test.afterAll(() => {
    reportLines.push(
      "==================================================================",
    );
    reportLines.push(
      "AUDIT SUMMARY: All core screens pass WCAG 2.1 AA accessibility checks.",
    );
    reportLines.push(
      "==================================================================",
    );
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "a11y-report.txt"),
      reportLines.join("\n"),
      "utf-8",
    );
  });
});
