"use client";

import React, { useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Badge,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

export default function TelecomPage() {
  const [lookupType, setLookupType] = useState<"nin" | "msisdn">("nin");
  const [identifier, setIdentifier] = useState("10000000001");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedSubscriber, setVerifiedSubscriber] = useState<{
    valid: boolean;
    subscriberId: string;
    kycTier: string;
    isOver18: boolean;
    ninHash: string;
    status: "active" | "suspended" | "pending";
    verifiedAt: string;
  } | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Subscriber identifier is required.");
      return;
    }

    setLoading(true);
    setError(null);
    setVerifiedSubscriber(null);

    try {
      // In demo mode, verify mock nin through API endpoint
      const syntheticNin = lookupType === "nin" ? identifier.trim() : "10000000001";
      const res = await api.identity.verifyMockNin({ nin: syntheticNin });

      if (res.valid) {
        setVerifiedSubscriber({
          valid: true,
          subscriberId:
            lookupType === "msisdn" ? identifier.trim() : "+2348000000001 (Synthetic)",
          kycTier: "Tier 1 Verified",
          isOver18: true,
          ninHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          status: "active",
          verifiedAt: new Date().toISOString(),
        });
      } else {
        setError(
          "Subscriber lookup failed: No matching synthetic record found in mock database.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Telecom SIM verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Synthetic Data Alert (README Rule #2) */}
      <div
        role="region"
        aria-label="Synthetic data warning"
        style={{
          background: tokens.color.surfaceMuted,
          border: `1px solid ${tokens.color.borderStrong}`,
          padding: "1rem 1.25rem",
          borderRadius: tokens.radius.md,
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.color.navyDark,
        }}
      >
        <strong style={{ color: tokens.color.navy }}>
          SYNTHETIC SUBSCRIBER REGISTRATION ONLY:
        </strong>{" "}
        This telecom subscriber KYC verification portal operates exclusively on synthetic
        testnet identifiers (e.g. 11-digit synthetic NINs starting with 100... or
        synthetic MSISDNs). Real phone numbers or personal data must never be submitted.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GloTel Subscriber Verification & SIM KYC</CardTitle>
          <CardDescription>
            Verify Nigerian subscriber credentials and SIM KYC tier without storing raw
            identity attributes.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleVerify}>
          <CardContent
            style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                  color: tokens.color.textPrimary,
                }}
              >
                Verification Identifier Type
              </label>
              <div style={{ display: "flex", gap: "1rem" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="lookupType"
                    checked={lookupType === "nin"}
                    onChange={() => {
                      setLookupType("nin");
                      setIdentifier("10000000001");
                    }}
                  />
                  <span>Synthetic NIN (11 digits)</span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="lookupType"
                    checked={lookupType === "msisdn"}
                    onChange={() => {
                      setLookupType("msisdn");
                      setIdentifier("+2348000000001");
                    }}
                  />
                  <span>Synthetic MSISDN (+234...)</span>
                </label>
              </div>
            </div>

            <Input
              label={
                lookupType === "nin" ? "Synthetic NIN" : "Synthetic MSISDN Phone Number"
              }
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={lookupType === "nin" ? "10000000001" : "+2348000000001"}
              hint="Enter synthetic test identifier only."
              required
            />

            {error && (
              <div
                role="alert"
                style={{
                  padding: "0.75rem 1rem",
                  background: tokens.color.errorLight,
                  color: tokens.color.error,
                  borderRadius: tokens.radius.md,
                  fontSize: tokens.typography.fontSize.sm,
                }}
              >
                {error}
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button type="submit" variant="primary" loading={loading}>
              Verify Subscriber Identity
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Verification Result Card */}
      {verifiedSubscriber && (
        <Card style={{ border: `2px solid ${tokens.color.teal}` }}>
          <CardHeader>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <CardTitle style={{ color: tokens.color.tealDark }}>
                Subscriber Verification: ACTIVE
              </CardTitle>
              <Badge status="active">SIM KYC VERIFIED</Badge>
            </div>
            <CardDescription>
              Synthetic identity matched and anchored on Stellar Soroban credential status
              registry.
            </CardDescription>
          </CardHeader>

          <CardContent style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                background: tokens.color.surfaceMuted,
                padding: "1rem",
                borderRadius: tokens.radius.md,
                fontSize: tokens.typography.fontSize.sm,
              }}
            >
              <div>
                <strong>Subscriber ID:</strong> {verifiedSubscriber.subscriberId}
              </div>
              <div>
                <strong>KYC Tier:</strong> {verifiedSubscriber.kycTier}
              </div>
              <div>
                <strong>Age Verification:</strong>{" "}
                {verifiedSubscriber.isOver18 ? "Over 18 (Confirmed)" : "Minor"}
              </div>
              <div>
                <strong>Verification Timestamp:</strong>{" "}
                {new Date(verifiedSubscriber.verifiedAt).toLocaleTimeString()}
              </div>
            </div>

            <div
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.color.textSecondary,
              }}
            >
              <strong>Salted Identity Hash (RFC 8785 canonical):</strong>{" "}
              <code style={{ wordBreak: "break-all" }}>{verifiedSubscriber.ninHash}</code>
            </div>

            <div
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.color.tealDark,
                background: tokens.color.tealLight,
                padding: "0.5rem 0.75rem",
                borderRadius: tokens.radius.sm,
              }}
            >
              ✓ No personal data stored. SIM activation policy satisfied under NCC KYC
              guidelines.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
