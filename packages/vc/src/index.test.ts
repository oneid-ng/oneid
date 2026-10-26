import { describe, it, expect } from "vitest";
import { issueCredential, presentCredential, verifyPresentation } from "./index.js";

describe("@oneid/vc stubs", () => {
  it("issueCredential throws NOT IMPLEMENTED YET", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => issueCredential({} as any, "")).toThrow(
      "NOT IMPLEMENTED YET",
    );
  });

  it("presentCredential throws NOT IMPLEMENTED YET", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => presentCredential({} as any, [], "")).toThrow(
      "NOT IMPLEMENTED YET",
    );
  });

  it("verifyPresentation throws NOT IMPLEMENTED YET", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => verifyPresentation({} as any)).toThrow(
      "NOT IMPLEMENTED YET",
    );
  });
});
