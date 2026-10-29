/**
 * apps/api/src/pii-scan.test.ts
 *
 * Automated on-chain PII scan (README §20.1, §25, rule #1).
 *
 * Requirement:
 *   "No personal data is present in any contract storage, event or transaction memo
 *   (verified by an automated scan of indexer data and on-chain records)."
 *
 * Rules:
 *   - Fails if any contract storage, event topic/data, or transaction memo
 *     contains a known synthetic personal value (name, NIN, address, DOB).
 */

import { describe, it, expect } from "vitest";

export interface SyntheticProfile {
  id: string;
  fullName: string;
  syntheticNin: string;
  dateOfBirth: string;
  address: string;
}

export const SYNTHETIC_PROFILES: SyntheticProfile[] = [
  {
    id: "profile-001",
    fullName: "Adaeze Okonkwo",
    syntheticNin: "SYNTH-0000-0001",
    dateOfBirth: "1990-03-12",
    address: "Lagos, Nigeria (fictional)",
  },
  {
    id: "profile-002",
    fullName: "Emeka Nwosu",
    syntheticNin: "SYNTH-0000-0002",
    dateOfBirth: "1985-07-22",
    address: "Abuja, Nigeria (fictional)",
  },
  {
    id: "profile-003",
    fullName: "Fatima Bello",
    syntheticNin: "SYNTH-0000-0003",
    dateOfBirth: "1998-11-04",
    address: "Kano, Nigeria (fictional)",
  },
];

/** Known synthetic PII values that must NEVER appear on-chain */
const KNOWN_SYNTHETIC_PII: string[] = [
  ...SYNTHETIC_PROFILES.map((p) => p.fullName),
  ...SYNTHETIC_PROFILES.map((p) => p.syntheticNin),
  ...SYNTHETIC_PROFILES.map((p) => p.dateOfBirth),
  ...SYNTHETIC_PROFILES.map((p) => p.address),
  "1234 5678 9012",
  "9876 5432 1098",
  "1111 2222 3333",
  "Adaeze Okonkwo",
  "Emeka Nwosu",
  "Fatima Bello",
];

export interface OnChainRecord {
  contractId: string;
  storageKeys?: string[];
  storageValues?: string[];
  eventTopics?: string[];
  eventData?: string[];
  transactionMemos?: string[];
}

/**
 * Scanner function that checks a collection of on-chain records
 * against the known synthetic PII dictionary.
 */
export function scanOnChainDataForPii(records: OnChainRecord[]): {
  clean: boolean;
  violations: Array<{
    contractId: string;
    field: string;
    detectedValue: string;
  }>;
} {
  const violations: Array<{
    contractId: string;
    field: string;
    detectedValue: string;
  }> = [];

  for (const rec of records) {
    const fieldsToCheck: Array<{ name: string; values?: string[] | undefined }> = [
      { name: "storageKeys", values: rec.storageKeys },
      { name: "storageValues", values: rec.storageValues },
      { name: "eventTopics", values: rec.eventTopics },
      { name: "eventData", values: rec.eventData },
      { name: "transactionMemos", values: rec.transactionMemos },
    ];

    for (const field of fieldsToCheck) {
      if (!field.values) continue;
      for (const val of field.values) {
        if (!val) continue;
        const normalized = val.toLowerCase();
        for (const pii of KNOWN_SYNTHETIC_PII) {
          if (normalized.includes(pii.toLowerCase())) {
            violations.push({
              contractId: rec.contractId,
              field: field.name,
              detectedValue: pii,
            });
          }
        }
      }
    }
  }

  return {
    clean: violations.length === 0,
    violations,
  };
}

describe("Automated On-Chain PII Scanner (README §20.1, §25)", () => {
  it("passes when on-chain records contain only hashes, addresses, status codes and timestamps", () => {
    const validOnChainData: OnChainRecord[] = [
      {
        contractId: "CA7QONEIDISSUERREGISTRYLOCALDEMOCONTRACTID000000000000000000",
        storageKeys: [
          "entity:GISSUERONEIDDEMOISSUER0000000000000000000000000000000000000",
        ],
        storageValues: ["Active:1793110890:issuer.demo.oneid.local"],
        eventTopics: ["issuer_registered"],
        eventData: [
          "GISSUERONEIDDEMOISSUER0000000000000000000000000000000000000",
          "Active",
        ],
        transactionMemos: ["ONEiD:reg:7f8a9b"],
      },
      {
        contractId: "CB2KONEIDCREDENTIALSTATUSLOCALDEMOCONTRACTID000000000000000",
        storageKeys: [
          "cred:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        ],
        storageValues: ["Active:1793110890"],
        eventTopics: ["credential_registered"],
        eventData: ["e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
        transactionMemos: ["ONEiD:cred:reg"],
      },
      {
        contractId: "CC3KONEIDCONSENTREGISTRYLOCALDEMOCONTRACTID00000000000000",
        storageKeys: [
          "receipt:9f83c605d4c82b3e925b9000a68d0d57e4e1be486a43d9fb3f9f30b96b349079",
        ],
        storageValues: ["Active:1793200000:nonce456"],
        eventTopics: ["consent_recorded"],
        eventData: ["9f83c605d4c82b3e925b9000a68d0d57e4e1be486a43d9fb3f9f30b96b349079"],
        transactionMemos: ["ONEiD:consent:tx"],
      },
      {
        contractId: "CD4KONEIDCORRECTIONTRACKERLOCALDEMOCONTRACTID000000000000",
        storageKeys: [
          "ticket:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
        ],
        storageValues: ["GBANK000001:applied:1793200000"],
        eventTopics: ["correction_updated"],
        eventData: ["GBANK000001", "applied"],
        transactionMemos: ["ONEiD:corr:tx"],
      },
    ];

    const result = scanOnChainDataForPii(validOnChainData);
    expect(result.clean).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("fails if any synthetic personal name is detected in event topics or data", () => {
    const taintedData: OnChainRecord[] = [
      {
        contractId: "CC3KONEIDCONSENTREGISTRYLOCALDEMOCONTRACTID00000000000000",
        eventTopics: ["consent_recorded"],
        eventData: ["Adaeze Okonkwo", "consent_granted"],
      },
    ];

    const result = scanOnChainDataForPii(taintedData);
    expect(result.clean).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "eventData",
          detectedValue: "Adaeze Okonkwo",
        }),
      ]),
    );
  });

  it("fails if any synthetic NIN is detected in transaction memos or storage keys", () => {
    const taintedData: OnChainRecord[] = [
      {
        contractId: "CB2KONEIDCREDENTIALSTATUSLOCALDEMOCONTRACTID000000000000000",
        storageKeys: ["cred:SYNTH-0000-0001"],
        transactionMemos: ["issue:1234 5678 9012"],
      },
    ];

    const result = scanOnChainDataForPii(taintedData);
    expect(result.clean).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });

  it("fails if address or date of birth leaks into contract storage values", () => {
    const taintedData: OnChainRecord[] = [
      {
        contractId: "CD4KONEIDCORRECTIONTRACKERLOCALDEMOCONTRACTID000000000000",
        storageValues: ["correction:1990-03-12:Lagos, Nigeria (fictional)"],
      },
    ];

    const result = scanOnChainDataForPii(taintedData);
    expect(result.clean).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ detectedValue: "1990-03-12" }),
        expect.objectContaining({ detectedValue: "Lagos, Nigeria (fictional)" }),
      ]),
    );
  });
});
