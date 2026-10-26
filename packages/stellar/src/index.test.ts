import { describe, it, expect } from "vitest";
import {
  LOCAL_NETWORK,
  TESTNET_NETWORK,
  resolveNetwork,
} from "./index.js";

describe("@oneid/stellar network config", () => {
  it("LOCAL_NETWORK points to localhost", () => {
    expect(LOCAL_NETWORK.rpcUrl).toContain("localhost");
    expect(LOCAL_NETWORK.name).toBe("local");
  });

  it("TESTNET_NETWORK points to stellar.org", () => {
    expect(TESTNET_NETWORK.rpcUrl).toContain("stellar.org");
    expect(TESTNET_NETWORK.name).toBe("testnet");
  });

  it("resolveNetwork defaults to local when STELLAR_NETWORK unset", () => {
    const original = process.env["STELLAR_NETWORK"];
    delete process.env["STELLAR_NETWORK"];
    expect(resolveNetwork().name).toBe("local");
    if (original !== undefined) process.env["STELLAR_NETWORK"] = original;
  });

  it("resolveNetwork returns testnet when STELLAR_NETWORK=testnet", () => {
    const original = process.env["STELLAR_NETWORK"];
    process.env["STELLAR_NETWORK"] = "testnet";
    expect(resolveNetwork().name).toBe("testnet");
    if (original !== undefined) process.env["STELLAR_NETWORK"] = original;
    else delete process.env["STELLAR_NETWORK"];
  });
});
