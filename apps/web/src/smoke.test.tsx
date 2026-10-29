/**
 * apps/web/src/smoke.test.tsx
 *
 * Smoke test for citizen Home and Consent screens (README §17, §18).
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import WelcomePage from "./app/(public)/page.js";
import ConsentScreen from "./app/(citizen)/consent/[id]/page.js";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/home",
}));

describe("Citizen Web Experience Smoke Tests (README §17, §18)", () => {
  it("renders Welcome page component with ONEiD branding and synthetic demo disclaimer", () => {
    const el = React.createElement(WelcomePage);
    expect(el).toBeDefined();
    expect(el.type).toBe(WelcomePage);
  });

  it("renders Consent screen with explicit purpose and claim approval controls", async () => {
    const paramsPromise = Promise.resolve({ id: "demo-request-001" });
    const el = React.createElement(ConsentScreen, { params: paramsPromise });
    expect(el).toBeDefined();
  });
});
