"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Badge,
  tokens,
} from "@oneid/ui";

interface ExceptionItem {
  id: string;
  code: string;
  title: string;
  description: string;
  badgeStatus:
    | "revoked"
    | "expired"
    | "suspended"
    | "withdrawn"
    | "rejected"
    | "failed"
    | "partially_applied";
  technicalReason: string;
  recommendedAction: string;
}

const EXCEPTION_STATES: ExceptionItem[] = [
  {
    id: "expired-consent",
    code: "CONSENT_EXPIRED",
    title: "Consent Period Has Expired",
    description:
      "Your authorization for this relying party has reached its expiration timestamp. In accordance with NDPA 2023 principles, data access is immediately terminated upon expiry. Re-consent is required before attributes can be shared again.",
    badgeStatus: "expired",
    technicalReason: "Consent receipt valid_until timestamp < current ledger timestamp.",
    recommendedAction:
      "Request a fresh verification challenge and re-approve disclosable attributes.",
  },
  {
    id: "withdrawn-consent",
    code: "CONSENT_WITHDRAWN",
    title: "Consent Explicitly Withdrawn",
    description:
      "You have withdrawn consent on the Stellar Soroban consent-registry contract. Future attribute sharing for this recipient is completely blocked. Notice: Withdrawing consent affects FUTURE sharing only; it does not erase data already received by another institution.",
    badgeStatus: "withdrawn",
    technicalReason: "Consent receipt state marked Withdrawn on Soroban contract.",
    recommendedAction:
      "No action required if you intended to revoke access. Otherwise, initiate a new request.",
  },
  {
    id: "revoked-credential",
    code: "CREDENTIAL_REVOKED",
    title: "Credential Revoked or Invalid",
    description:
      "This credential is no longer valid. The issuing institution has revoked the credential on the Soroban credential-status contract, or its cryptographic signature failed verification. Relying parties fail closed and deny verification.",
    badgeStatus: "revoked",
    technicalReason: "Soroban credential-status entry marked Revoked with reason code.",
    recommendedAction:
      "Contact the identity issuer to submit a new identity verification application.",
  },
  {
    id: "suspended-issuer",
    code: "ISSUER_NOT_ACTIVE",
    title: "Issuing Institution Suspended",
    description:
      "The institution that issued this credential is currently suspended or removed on the Soroban issuer-registry. To prevent fraudulent acceptance of unverified credentials, presentations from suspended issuers fail closed.",
    badgeStatus: "suspended",
    technicalReason:
      "Issuer entity status != Active on Soroban issuer-registry contract.",
    recommendedAction:
      "Wait for the issuer to resolve compliance review with the system administrator.",
  },
  {
    id: "wrong-role",
    code: "FORBIDDEN_ROLE_403",
    title: "Wrong Role / Action Denied",
    description:
      "You do not possess the required role permissions to perform this operation or access this portal. Access control fails closed by default to enforce institutional boundaries and safeguard citizen privacy.",
    badgeStatus: "rejected",
    technicalReason: "Session user role does not match declared route permission policy.",
    recommendedAction:
      "Switch to an authorized institutional demo profile or return to the citizen portal.",
  },
  {
    id: "rejected-correction",
    code: "CORRECTION_REJECTED",
    title: "Identity Correction Rejected",
    description:
      "The target institution reviewed your requested record update and declined the modification based on independent internal validation criteria. Each institution retains full sovereign authority over its own records.",
    badgeStatus: "rejected",
    technicalReason:
      "Institution posted status 'Rejected' with reason code to correction-tracker.",
    recommendedAction:
      "Check your synthetic supporting documents and submit an updated correction ticket.",
  },
  {
    id: "partial-update",
    code: "PARTIAL_SYNC_WARNING",
    title: "Partial Synchronization Across Institutions",
    description:
      "Your update request was successfully applied by some institutions, but remains pending, rejected, or failed at others. Multi-institution updates operate independently without a single point of failure.",
    badgeStatus: "partially_applied",
    technicalReason:
      "Heterogeneous outcome statuses recorded on correction-tracker contract.",
    recommendedAction:
      "Review the per-institution timeline and retry only the failed institution.",
  },
  {
    id: "failed-retry",
    code: "RETRY_EXHAUSTED",
    title: "Operation Failed After Maximum Retries",
    description:
      "The system attempted to execute this operation multiple times with exponential backoff, but the remote institution service or blockchain endpoint repeatedly failed to respond.",
    badgeStatus: "failed",
    technicalReason:
      "Network timeout or non-retryable 5xx response from institutional adapter.",
    recommendedAction:
      "Check network connectivity and verify the institutional service status.",
  },
  {
    id: "chain-unavailable",
    code: "CHAIN_UNAVAILABLE",
    title: "Stellar Network / RPC Unreachable",
    description:
      "The Stellar Quickstart local network or Soroban RPC endpoint is temporarily unreachable. The platform fails closed: credentials, consent, and registry queries cannot proceed until blockchain connectivity is restored.",
    badgeStatus: "failed",
    technicalReason:
      "Soroban RPC JSON-RPC healthcheck failed or returned 503 Service Unavailable.",
    recommendedAction:
      "Ensure local Stellar Quickstart Docker container is running on port 8000.",
  },
];

export default function ExceptionsPage() {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Record<string, boolean>>({});

  const handleSimulateRetry = async (id: string) => {
    setRetryingId(id);
    await new Promise((r) => setTimeout(r, 600));
    setRetryingId(null);
    setResolvedIds((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: tokens.color.offWhite,
      }}
    >
      {/* Testnet & Synthetic Data Banner (README §4, §21) */}
      <div
        role="region"
        aria-label="Demo environment notification"
        style={{
          background: tokens.color.navyDark,
          color: tokens.color.goldLight,
          fontSize: tokens.typography.fontSize.xs,
          padding: "0.5rem 1rem",
          textAlign: "center",
          fontWeight: 500,
        }}
      >
        ONEiD Stellar Testnet Demo · Synthetic Data Only · No Real Personal Data On-Chain
        · No Claims of Compliance or Official Affiliation
      </div>

      <header
        style={{
          background: tokens.color.surface,
          borderBottom: `1px solid ${tokens.color.border}`,
          padding: "1rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: "50%",
              background: tokens.color.navy,
              color: tokens.color.gold,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
            }}
          >
            1
          </span>
          <span
            style={{
              fontWeight: 700,
              fontSize: tokens.typography.fontSize.xl,
              color: tokens.color.navy,
            }}
          >
            ONEiD
          </span>
        </Link>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Button variant="ghost" size="sm">
            ← Return to Home
          </Button>
        </Link>
      </header>

      <main
        style={{
          flex: 1,
          padding: "2rem 1.5rem",
          maxWidth: "64rem",
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: tokens.typography.fontSize["2xl"],
              color: tokens.color.navy,
              marginBottom: "0.5rem",
            }}
          >
            Exception States & Fail-Closed UX (README §18.5)
          </h1>
          <p
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.color.textSecondary,
              lineHeight: tokens.typography.lineHeight.normal,
              margin: 0,
            }}
          >
            Under ONEiD non-negotiable rules, all security exceptions fail closed with
            clear, plain-language explanations. Below are the 9 mandatory system exception
            states.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {EXCEPTION_STATES.map((item) => {
            const isResolved = resolvedIds[item.id] ?? false;
            return (
              <Card
                key={item.id}
                style={{
                  border: isResolved
                    ? `1px solid ${tokens.color.teal}`
                    : `1px solid ${tokens.color.borderStrong}`,
                  background: isResolved ? tokens.color.surface : tokens.color.surface,
                }}
              >
                <CardHeader>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.xs,
                          fontFamily: "monospace",
                          color: tokens.color.textSecondary,
                          marginBottom: "0.25rem",
                        }}
                      >
                        EXCEPTION CODE: {item.code}
                      </div>
                      <CardTitle style={{ color: tokens.color.navyDark }}>
                        {item.title}
                      </CardTitle>
                    </div>
                    <Badge status={isResolved ? "active" : item.badgeStatus}>
                      {isResolved ? "RESOLVED (TEST)" : item.badgeStatus.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent
                  style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                >
                  <p
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.color.textPrimary,
                      lineHeight: tokens.typography.lineHeight.normal,
                      margin: 0,
                    }}
                  >
                    {item.description}
                  </p>

                  <div
                    style={{
                      background: tokens.color.surfaceMuted,
                      padding: "0.75rem 1rem",
                      borderRadius: tokens.radius.sm,
                      fontSize: tokens.typography.fontSize.xs,
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    <div>
                      <strong>Technical Trigger:</strong>{" "}
                      <code>{item.technicalReason}</code>
                    </div>
                    <div>
                      <strong>Recommended Resolution:</strong> {item.recommendedAction}
                    </div>
                  </div>
                </CardContent>

                <CardFooter
                  style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
                >
                  <Button
                    size="sm"
                    variant={isResolved ? "outline" : "primary"}
                    loading={retryingId === item.id}
                    onClick={() => handleSimulateRetry(item.id)}
                  >
                    {isResolved
                      ? "Retried Successfully ✓"
                      : "Simulate Retry with Backoff"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </main>

      <footer
        style={{
          borderTop: `1px solid ${tokens.color.border}`,
          padding: "1.5rem",
          textAlign: "center",
          fontSize: tokens.typography.fontSize.xs,
          color: tokens.color.textSecondary,
          background: tokens.color.surface,
        }}
      >
        ONEiD Prototype · Synthetic Data Only · Stellar Local Testnet · WCAG 2.1 AA
        Accessible
      </footer>
    </div>
  );
}
