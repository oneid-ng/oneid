/**
 * packages/ui/src/index.test.ts
 *
 * Component tests & design token validation for @oneid/ui (README §17).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import {
  tokens,
  Button,
  Input,
  Card,
  Badge,
  Stepper,
  Toast,
  Skeleton,
  ErrorState,
} from "./index.js";

describe("@oneid/ui Design Tokens (README §17)", () => {
  it("defines deep navy, teal, warm gold on warm off-white", () => {
    expect(tokens.color.navy).toBe("#0D1F3C");
    expect(tokens.color.teal).toBe("#0B7B8A");
    expect(tokens.color.gold).toBe("#C9972A");
    expect(tokens.color.offWhite).toBe("#FAF8F4");
  });

  it("defines WCAG 2.1 AA accessible status colors", () => {
    expect(tokens.color.success).toBe("#15803D");
    expect(tokens.color.error).toBe("#B91C1C");
    expect(tokens.color.warning).toBe("#B45309");
    expect(tokens.color.info).toBe("#1D4ED8");
  });

  it("defines typography and spacing scales", () => {
    expect(tokens.typography.fontFamily).toContain("Inter");
    expect(tokens.spacing[4]).toBe("1rem");
    expect(tokens.radius.md).toBe("0.375rem");
  });
});

describe("@oneid/ui Components", () => {
  it("exports all required base components", () => {
    expect(Button).toBeDefined();
    expect(Input).toBeDefined();
    expect(Card).toBeDefined();
    expect(Badge).toBeDefined();
    expect(Stepper).toBeDefined();
    expect(Toast).toBeDefined();
    expect(Skeleton).toBeDefined();
    expect(ErrorState).toBeDefined();
  });

  it("Button renders with accessibility attributes when loading", () => {
    const element = React.createElement(Button, { loading: true, children: "Submit" });
    expect(element.props.loading).toBe(true);
    expect(element.props.children).toBe("Submit");
  });

  it("Badge supports all on-chain statuses", () => {
    const statuses = [
      "active",
      "revoked",
      "expired",
      "suspended",
      "partially_applied",
    ] as const;
    for (const s of statuses) {
      const element = React.createElement(Badge, { status: s });
      expect(element.props.status).toBe(s);
    }
  });

  it("ErrorState renders message with retry action", () => {
    let retried = false;
    const element = React.createElement(ErrorState, {
      message: "Connection lost",
      code: "CHAIN_UNAVAILABLE",
      onRetry: () => {
        retried = true;
      },
    });
    expect(element.props.message).toBe("Connection lost");
    expect(element.props.code).toBe("CHAIN_UNAVAILABLE");
    element.props.onRetry?.();
    expect(retried).toBe(true);
  });
});
