"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  tokens,
} from "@oneid/ui";

export default function AnchorDemoPage() {
  const [step, setStep] = useState<
    "start" | "kyc_check" | "consent" | "completed" | "blocked"
  >("start");
  const [kycOption, setKycOption] = useState<"valid" | "withdrawn" | "revoked">("valid");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const anchorAddress = "GANCHORONEIDDEMOANCHOR0000000000000000000000000000000000000";
  const userAccount = "GBDEMOACCOUNT0000000000000000000000000000000000000000000001";

  const handleStartDeposit = () => {
    setLoading(true);
    setErrorMessage(null);
    setTimeout(() => {
      setLoading(false);
      setStep("kyc_check");
    }, 400);
  };

  const handleVerifyKyc = () => {
    setLoading(true);
    setErrorMessage(null);
    setTimeout(() => {
      setLoading(false);
      if (kycOption === "valid") {
        setStep("completed");
      } else if (kycOption === "withdrawn") {
        setStep("blocked");
        setErrorMessage(
          "Consent receipt has been withdrawn by citizen on-chain. Verification failed closed.",
        );
      } else {
        setStep("blocked");
        setErrorMessage(
          "Credential has been revoked on Soroban credential-status contract. Deposit blocked.",
        );
      }
    }, 600);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: tokens.color.offWhite,
      }}
    >
      <div
        role="region"
        aria-label="Demo notice"
        style={{
          width: "100%",
          maxWidth: "42rem",
          background: tokens.color.surfaceMuted,
          border: `1px solid ${tokens.color.borderStrong}`,
          borderRadius: tokens.radius.md,
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          fontSize: tokens.typography.fontSize.xs,
          color: tokens.color.textSecondary,
          textAlign: "center",
        }}
      >
        <strong style={{ color: tokens.color.navy }}>SEP-STYLE DEMO:</strong> Mock Anchor
        Onboarding (README §16). SEP-1 / SEP-10 / SEP-12 / SEP-24 flow. No real money or
        assets.
      </div>

      <Card style={{ width: "100%", maxWidth: "38rem", padding: "1.5rem" }}>
        <CardHeader>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <CardTitle>Mock Anchor — SEP-24 Onboarding</CardTitle>
            <Badge status="active">SEP-style demo</Badge>
          </div>
          <CardDescription>
            Reusable KYC flow: Deposit naira &rarr; receive mock stablecoin without
            repeated document uploads.
          </CardDescription>
        </CardHeader>

        <CardContent style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {step === "start" && (
            <div>
              <p
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.color.textSecondary,
                }}
              >
                Start an interactive deposit with the demo anchor. The anchor
                authenticates via SEP-10, requests KYC fields via SEP-12, and verifies
                ONEiD credentials on-chain.
              </p>
              <div
                style={{
                  background: "#F3EFE6",
                  padding: "1rem",
                  borderRadius: "6px",
                  marginBottom: "1rem",
                }}
              >
                <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
                  <strong>Anchor:</strong> <code>{anchorAddress}</code>
                </p>
                <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
                  <strong>User Account:</strong> <code>{userAccount}</code>
                </p>
                <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
                  <strong>Deposit:</strong> 10,000 NGN &rarr; <strong>Receive:</strong>{" "}
                  6.67 USDC (Synthetic)
                </p>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    display: "block",
                    marginBottom: "0.5rem",
                  }}
                >
                  Simulate Credential / Consent Condition:
                </label>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <label style={{ fontSize: "0.85rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="kycOption"
                      checked={kycOption === "valid"}
                      onChange={() => setKycOption("valid")}
                    />{" "}
                    Valid (Active Consent & Active Credential)
                  </label>
                  <label style={{ fontSize: "0.85rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="kycOption"
                      checked={kycOption === "withdrawn"}
                      onChange={() => setKycOption("withdrawn")}
                    />{" "}
                    Consent Withdrawn
                  </label>
                  <label style={{ fontSize: "0.85rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="kycOption"
                      checked={kycOption === "revoked"}
                      onChange={() => setKycOption("revoked")}
                    />{" "}
                    Credential Revoked
                  </label>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                loading={loading}
                onClick={handleStartDeposit}
                style={{ width: "100%" }}
                id="btn-start-deposit"
              >
                Start Interactive Deposit
              </Button>
            </div>
          )}

          {step === "kyc_check" && (
            <div>
              <div
                style={{
                  borderLeft: "4px solid #0B7B8A",
                  paddingLeft: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <h4 style={{ margin: "0 0 0.5rem 0" }}>
                  SEP-12 Reusable KYC Verification
                </h4>
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: tokens.color.textSecondary,
                    margin: 0,
                  }}
                >
                  The anchor checks on-chain credential status and consent receipt before
                  proceeding.
                </p>
              </div>

              <div
                style={{
                  background: "#F3EFE6",
                  padding: "1rem",
                  borderRadius: "6px",
                  marginBottom: "1rem",
                  fontSize: "0.85rem",
                }}
              >
                <p style={{ margin: "0.25rem 0" }}>
                  🔍 Verifying Issuer in Soroban <code>issuer-registry</code>...
                </p>
                <p style={{ margin: "0.25rem 0" }}>
                  🔍 Checking Credential status in <code>credential-status</code>...
                </p>
                <p style={{ margin: "0.25rem 0" }}>
                  🔍 Verifying Holder consent receipt in <code>consent-registry</code>...
                </p>
              </div>

              <Button
                variant="primary"
                size="lg"
                loading={loading}
                onClick={handleVerifyKyc}
                style={{ width: "100%" }}
                id="btn-verify-kyc"
              >
                Proceed with On-Chain Verification
              </Button>
            </div>
          )}

          {step === "completed" && (
            <div id="anchor-success-state">
              <div
                style={{
                  background: "#D1FAE5",
                  border: "1px solid #10B981",
                  borderRadius: "6px",
                  padding: "1rem",
                  marginBottom: "1rem",
                  color: "#065F46",
                }}
              >
                <h4 style={{ margin: "0 0 0.5rem 0" }}>
                  ✅ Anchor Onboarding Successful
                </h4>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem" }}>
                  Proceeded without any document upload! Verified on-chain via ONEiD:
                </p>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
                  <li>
                    Active Issuer: Verified in <code>issuer-registry</code>
                  </li>
                  <li>
                    Active Credential: Verified in <code>credential-status</code>
                  </li>
                  <li>
                    Active Consent: Verified in <code>consent-registry</code>
                  </li>
                </ul>
              </div>

              <p style={{ fontSize: "0.85rem", color: tokens.color.textSecondary }}>
                Transaction complete: <strong>10,000 NGN</strong> &rarr;{" "}
                <strong>6.67 USDC</strong> minted to user account. Zero documents
                uploaded.
              </p>

              <Button
                variant="outline"
                size="md"
                onClick={() => setStep("start")}
                style={{ width: "100%" }}
              >
                Reset Demo
              </Button>
            </div>
          )}

          {step === "blocked" && (
            <div id="anchor-blocked-state">
              <div
                style={{
                  background: "#FEE2E2",
                  border: "1px solid #EF4444",
                  borderRadius: "6px",
                  padding: "1rem",
                  marginBottom: "1rem",
                  color: "#991B1B",
                }}
              >
                <h4 style={{ margin: "0 0 0.5rem 0" }}>
                  ⛔ Onboarding Blocked (Fail Closed)
                </h4>
                <p style={{ margin: 0, fontSize: "0.85rem" }} id="anchor-error-reason">
                  {errorMessage}
                </p>
              </div>

              <p style={{ fontSize: "0.85rem", color: tokens.color.textSecondary }}>
                Under fail-closed security rules (README §5, §16), the anchor refuses
                transaction execution when consent is withdrawn or the credential is
                revoked.
              </p>

              <Button
                variant="secondary"
                size="md"
                onClick={() => setStep("start")}
                style={{ width: "100%" }}
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>

        <CardFooter
          style={{ borderTop: `1px solid ${tokens.color.border}`, paddingTop: "1rem" }}
        >
          <Link
            href="/"
            style={{
              fontSize: "0.85rem",
              color: tokens.color.teal,
              textDecoration: "none",
            }}
          >
            &larr; Return to Welcome Portal
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
