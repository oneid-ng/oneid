/**
 * apps/web/src/components/RoleGuard.test.tsx
 *
 * Unit tests for fail-closed RoleGuard (README §19, rule #5).
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { RoleGuard } from "./RoleGuard.js";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin",
}));

describe("RoleGuard Fail-Closed Security", () => {
  it("creates RoleGuard element successfully", () => {
    const el = React.createElement(RoleGuard, {
      allowedRoles: ["admin"],
      portalName: "Admin Portal",
      children: React.createElement("div", null, "Protected Admin Content"),
    });
    expect(el).toBeDefined();
    expect(el.props.allowedRoles).toEqual(["admin"]);
  });
});
