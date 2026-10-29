import { test, expect } from "@playwright/test";

test.describe("Role Guards & Institutional Portal Access Control (README §17, §19)", () => {
  const institutionalPortals = [
    { name: "Issuer Portal", path: "/issuer", requiredRole: "issuer" },
    { name: "Verifier Portal", path: "/verifier", requiredRole: "verifier" },
    { name: "Bank Portal", path: "/bank", requiredRole: "verifier" },
    { name: "Telecom Portal", path: "/telecom", requiredRole: "verifier" },
    { name: "Admin Portal", path: "/admin", requiredRole: "admin" },
  ];

  for (const portal of institutionalPortals) {
    test(`Fails closed on unauthorized access to ${portal.name} (${portal.path})`, async ({
      page,
    }) => {
      // Direct navigation without authentication or with wrong role
      await page.goto(portal.path);

      // Verify fail-closed denied state
      await expect(page.getByText("FORBIDDEN_ROLE (403)")).toBeVisible();
      await expect(page.getByText("Access Denied — Wrong Role")).toBeVisible();
      await expect(
        page.getByText("This portal requires an authorised role"),
      ).toBeVisible();
      await expect(page.getByText("Return Home")).toBeVisible();
    });
  }
});
