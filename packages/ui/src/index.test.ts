import { describe, it, expect } from "vitest";
import { tokens, UI_STUB } from "./index.js";

describe("@oneid/ui tokens", () => {
  it("navy token is defined", () => {
    expect(tokens.color.navy).toBe("#0D1F3C");
  });

  it("teal token is defined", () => {
    expect(tokens.color.teal).toBe("#0B7B8A");
  });

  it("gold accent token is defined", () => {
    expect(tokens.color.gold).toBe("#C9972A");
  });

  it("stub message mentions Phase 3", () => {
    expect(UI_STUB).toContain("Phase 3");
  });
});
