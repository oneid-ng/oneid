/**
 * @oneid/stellar
 *
 * Network configuration, account utilities and fee-bump / sponsorship helpers.
 * All keys used here are DEMO keys for local/testnet only — never mainnet.
 */

// ── Network configs ────────────────────────────────────────────────────────

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
  friendbotUrl: string;
}

export const LOCAL_NETWORK: NetworkConfig = {
  name: "local",
  rpcUrl: "http://localhost:8000/soroban/rpc",
  networkPassphrase: "Standalone Network ; February 2017",
  horizonUrl: "http://localhost:8000",
  friendbotUrl: "http://localhost:8000/friendbot",
};

export const TESTNET_NETWORK: NetworkConfig = {
  name: "testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  horizonUrl: "https://horizon-testnet.stellar.org",
  friendbotUrl: "https://friendbot.stellar.org",
};

/**
 * Resolve the active NetworkConfig from environment variables.
 * Defaults to LOCAL_NETWORK if STELLAR_NETWORK is unset or "local".
 */
export function resolveNetwork(): NetworkConfig {
  const name = process.env["STELLAR_NETWORK"] ?? "local";
  if (name === "testnet") return TESTNET_NETWORK;
  return LOCAL_NETWORK;
}

// ── Friendbot ──────────────────────────────────────────────────────────────

/**
 * Fund a Stellar account via Friendbot (local or testnet only).
 * Throws if the request fails.
 */
export async function fundAccount(
  address: string,
  network: NetworkConfig,
): Promise<void> {
  const url = `${network.friendbotUrl}?addr=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(
      `Friendbot failed for ${address}: HTTP ${res.status} — ${body}`,
    );
  }
}
