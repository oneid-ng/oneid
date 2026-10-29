"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  ErrorState,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

export default function ConsentReceiptPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const resolvedParams = use(params);
  const receiptHash = resolvedParams.hash;

  const [status, setStatus] = useState<"active" | "withdrawn">("active");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawNotice, setWithdrawNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleWithdraw = async () => {
    if (
      !confirm(
        "Are you sure you want to withdraw this consent receipt? This will block future verifications.",
      )
    ) {
      return;
    }

    setWithdrawing(true);
    setError(null);
    try {
      const res = await api.consents.withdraw(receiptHash);
      setStatus("withdrawn");
      setWithdrawNotice(
        res.notice ||
          "Withdrawing consent affects FUTURE sharing only; it does not erase data already received by another institution.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to withdraw consent receipt");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "38rem",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <div>
        <h2
          style={{
            margin: "0 0 0.25rem 0",
            fontSize: tokens.typography.fontSize["2xl"],
            color: tokens.color.navy,
          }}
        >
          Consent Receipt
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.color.textSecondary,
          }}
        >
          Cryptographic proof of explicit consent recorded on the Soroban{" "}
          <code>consent-registry</code> contract.
        </p>
      </div>

      {error && (
        <ErrorState
          title="Withdrawal error"
          message={error}
          onRetry={() => setError(null)}
          retryLabel="Dismiss"
        />
      )}

      {withdrawNotice && (
        <div
          role="status"
          style={{
            padding: "1rem",
            borderRadius: tokens.radius.md,
            background: tokens.color.warningLight,
            border: `1px solid ${tokens.color.warning}`,
            color: tokens.color.navyDark,
            fontSize: tokens.typography.fontSize.sm,
            lineHeight: tokens.typography.lineHeight.normal,
          }}
        >
          <strong>CONSENT WITHDRAWN:</strong> {withdrawNotice}
        </div>
      )}

      <Card>
        <CardHeader
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <CardTitle>On-Chain Consent Receipt</CardTitle>
            <CardDescription>
              Salted SHA-256 hash recorded via sponsored transaction
            </CardDescription>
          </div>
          <Badge status={status}>
            {status === "active" ? "Active (On-Chain)" : "Withdrawn"}
          </Badge>
        </CardHeader>

        <CardContent style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              background: tokens.color.surfaceMuted,
              padding: "1rem",
              borderRadius: tokens.radius.md,
              fontSize: tokens.typography.fontSize.xs,
            }}
          >
            <div>
              <span style={{ color: tokens.color.textMuted, display: "block" }}>
                Receipt Hash:
              </span>
              <code
                style={{
                  wordBreak: "break-all",
                  color: tokens.color.navy,
                  fontWeight: 600,
                }}
              >
                {receiptHash}
              </code>
            </div>

            <div>
              <span style={{ color: tokens.color.textMuted, display: "block" }}>
                Transaction Hash:
              </span>
              <code style={{ wordBreak: "break-all" }}>mock-tx-hash-sponsored-001</code>
            </div>

            <div>
              <span style={{ color: tokens.color.textMuted, display: "block" }}>
                Stellar Soroban Ledger:
              </span>
              <span>Ledger #1042 (Confirmed)</span>
            </div>

            <div>
              <span style={{ color: tokens.color.textMuted, display: "block" }}>
                Approved Claims Disclosed:
              </span>
              <span style={{ color: tokens.color.teal, fontWeight: 600 }}>
                over18, kycTier, fullName
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "0.75rem",
              borderRadius: tokens.radius.md,
              background: tokens.color.surfaceMuted,
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.color.textSecondary,
            }}
          >
            <strong>RFC 8785 Canonical JSON:</strong> Receipt computed using salted hash
            over holder DID, requester, claims, purpose, nonce, and expiry timestamp. No
            personal data stored on-chain.
          </div>
        </CardContent>

        <CardFooter
          style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}
        >
          <Link href="/requests" style={{ textDecoration: "none" }}>
            <Button variant="ghost">Back to Requests</Button>
          </Link>

          {status === "active" && (
            <Button variant="danger" loading={withdrawing} onClick={handleWithdraw}>
              Withdraw Consent
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
