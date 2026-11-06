/**
 * lib/identity-providers.ts — Identity & Liveness verification provider architecture.
 *
 * Implements extensible adapters for National Identity (NIMC NINAuth) and
 * ISO-compliant biometric liveness verification with synthetic demo defaults.
 */

export interface IdentityVerificationResult {
  verified: boolean;
  message: string;
  provider: "synthetic" | "nimc_direct" | "bvn_partner";
  profile?: Record<string, unknown> | undefined;
}

export interface IdentityVerificationProvider {
  verifyNin(nin: string): Promise<IdentityVerificationResult>;
}

export interface LivenessVerificationResult {
  verified: boolean;
  confidence: number;
  message: string;
  provider: "synthetic" | "external_biometric";
  _demo?: boolean | undefined;
}

export interface LivenessVerificationProvider {
  verifyLiveness(imageRef?: string): Promise<LivenessVerificationResult>;
}

// ── Synthetic Providers (Default, README §13.2, Rule #2) ───────────────────

export const SYNTHETIC_NINS = new Set([
  "1234 5678 9012",
  "9876 5432 1098",
  "1111 2222 3333",
]);

export class SyntheticIdentityVerificationProvider
  implements IdentityVerificationProvider
{
  async verifyNin(nin: string): Promise<IdentityVerificationResult> {
    const verified = SYNTHETIC_NINS.has(nin);
    return {
      verified,
      message: verified ? "NIN verified (synthetic)" : "NIN not recognised",
      provider: "synthetic",
      profile: verified
        ? {
            fullName: nin === "1234 5678 9012" ? "Adaeze Okonkwo" : "Chidi Okafor",
            kycTier: 2,
            nationality: "NGA",
          }
        : undefined,
    };
  }
}

export class SyntheticLivenessProvider implements LivenessVerificationProvider {
  async verifyLiveness(_imageRef?: string): Promise<LivenessVerificationResult> {
    return {
      verified: true,
      confidence: 0.97,
      message: "Simulated face check passed (no real biometrics used)",
      provider: "synthetic",
      _demo: true,
    };
  }
}

// ── Production Adapter Plugs ────────────────────────────────────────────────

export class NimcNinAuthProvider implements IdentityVerificationProvider {
  constructor(
    private readonly endpoint = process.env["NIMC_API_ENDPOINT"] || "",
    private readonly apiKey = process.env["NIMC_API_KEY"] || "",
  ) {}

  async verifyNin(nin: string): Promise<IdentityVerificationResult> {
    if (!this.endpoint || !this.apiKey) {
      // Graceful fallback to synthetic when live credentials not supplied
      return new SyntheticIdentityVerificationProvider().verifyNin(nin);
    }

    try {
      const response = await fetch(`${this.endpoint}/v1/nin/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ nin }),
      });

      if (!response.ok) {
        return {
          verified: false,
          message: `NIMC verification rejected: HTTP ${response.status}`,
          provider: "nimc_direct",
        };
      }

      const data = (await response.json()) as {
        verified: boolean;
        profile?: Record<string, unknown>;
      };
      return {
        verified: Boolean(data.verified),
        message: data.verified ? "NIMC identity verified" : "NIMC record not found",
        provider: "nimc_direct",
        profile: data.profile,
      };
    } catch (err) {
      return {
        verified: false,
        message: `NIMC connection error: ${err instanceof Error ? err.message : String(err)}`,
        provider: "nimc_direct",
      };
    }
  }
}

export class ExternalBiometricProvider implements LivenessVerificationProvider {
  constructor(
    private readonly endpoint = process.env["BIOMETRIC_API_ENDPOINT"] || "",
    private readonly apiKey = process.env["BIOMETRIC_API_KEY"] || "",
  ) {}

  async verifyLiveness(imageRef?: string): Promise<LivenessVerificationResult> {
    if (!this.endpoint || !this.apiKey) {
      return new SyntheticLivenessProvider().verifyLiveness(imageRef);
    }

    try {
      const response = await fetch(`${this.endpoint}/v1/liveness/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ imageRef }),
      });

      if (!response.ok) {
        return {
          verified: false,
          confidence: 0,
          message: "Liveness verification failed",
          provider: "external_biometric",
        };
      }

      const data = (await response.json()) as {
        verified: boolean;
        confidence: number;
      };
      return {
        verified: Boolean(data.verified),
        confidence: Number(data.confidence ?? 0),
        message: data.verified ? "Liveness check passed" : "Liveness check failed",
        provider: "external_biometric",
      };
    } catch {
      return {
        verified: false,
        confidence: 0,
        message: "Biometric service unreachable",
        provider: "external_biometric",
      };
    }
  }
}

export function getIdentityProvider(): IdentityVerificationProvider {
  if (process.env["IDENTITY_PROVIDER"] === "nimc" && process.env["NIMC_API_KEY"]) {
    return new NimcNinAuthProvider();
  }
  return new SyntheticIdentityVerificationProvider();
}

export function getLivenessProvider(): LivenessVerificationProvider {
  if (
    process.env["LIVENESS_PROVIDER"] === "biometric" &&
    process.env["BIOMETRIC_API_KEY"]
  ) {
    return new ExternalBiometricProvider();
  }
  return new SyntheticLivenessProvider();
}
