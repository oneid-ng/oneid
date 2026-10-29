"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Skeleton,
  ErrorState,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

interface ClaimItem {
  key: string;
  label: string;
  value: string;
}

export default function ConsentScreen({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const requestId = resolvedParams.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request details
  const [requesterName, setRequesterName] = useState("First Demo Bank");
  const [requesterDomain, setRequesterDomain] = useState("bank.demo.oneid.local");
  const [purpose, setPurpose] = useState("Tier 2 Bank Account Opening");
  const [expiryMinutes] = useState(60);

  // Claim by claim decisions: key -> "approve" | "deny"
  const [decisions, setDecisions] = useState<Record<string, "approve" | "deny">>({
    fullName: "approve",
    over18: "approve",
    kycTier: "approve",
    address: "deny",
  });

  const availableClaims: ClaimItem[] = [
    { key: "fullName", label: "Full Legal Name", value: "Adaeze Okonkwo" },
    { key: "over18", label: "Age Verification", value: "Over 18 (True)" },
    { key: "kycTier", label: "KYC Tier", value: "Tier 2 Verified" },
    { key: "address", label: "Residential Address", value: "Lagos, Nigeria (fictional)" },
  ];

  const loadRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      if (requestId !== "demo") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const req: any = await api.requests.getById(requestId).catch(() => null);
        if (req) {
          setRequesterName(req.verifierName || "Authorised Institution");
          setRequesterDomain(req.verifierDomain || "institution.demo.oneid.local");
          setPurpose(req.purpose || purpose);
          if (Array.isArray(req.claims)) {
            const initialDecisions: Record<string, "approve" | "deny"> = {};
            req.claims.forEach((c: string) => {
              initialDecisions[c] = "approve";
            });
            setDecisions(initialDecisions);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequest();
  }, [requestId]);

  const toggleClaim = (key: string) => {
    setDecisions((prev) => ({
      ...prev,
      [key]: prev[key] === "approve" ? "deny" : "approve",
    }));
  };

  const handleGrantConsent = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.consents.create({
        requestId:
          requestId === "demo" ? "00000000-0000-0000-0000-000000000001" : requestId,
        decisions,
        expiresInSeconds: expiryMinutes * 60,
      });

      // Redirect to consent receipt screen
      router.push(`/consent/receipt/${res.receiptHash}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record consent receipt on-chain",
      );
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          maxWidth: "36rem",
          margin: "0 auto",
        }}
      >
        <Skeleton height="3rem" />
        <Skeleton height="14rem" />
      </div>
    );
  }

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
          Authorisation Request
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.color.textSecondary,
          }}
        >
          Review the requested identity claims and explicitly grant or deny permission
          claim-by-claim.
        </p>
      </div>

      {error && (
        <ErrorState
          title="Consent submission error"
          message={error}
          onRetry={() => setError(null)}
          retryLabel="Dismiss"
        />
      )}

      <Card>
        <CardHeader>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <CardTitle>{requesterName}</CardTitle>
              <CardDescription>
                Domain: <code>{requesterDomain}</code>
              </CardDescription>
            </div>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                background: tokens.color.surfaceMuted,
                color: tokens.color.tealDark,
                padding: "0.25rem 0.5rem",
                borderRadius: tokens.radius.md,
                fontWeight: 700,
              }}
            >
              Expires in {expiryMinutes}m
            </span>
          </div>

          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem",
              borderRadius: tokens.radius.md,
              background: tokens.color.surfaceMuted,
              fontSize: tokens.typography.fontSize.sm,
            }}
          >
            <strong style={{ color: tokens.color.navy }}>Purpose: </strong>
            <span style={{ color: tokens.color.textPrimary }}>{purpose}</span>
          </div>
        </CardHeader>

        <CardContent style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <span
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: 600,
              color: tokens.color.navy,
            }}
          >
            Selective Disclosure Claims (Toggle to Approve or Deny):
          </span>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}
            role="group"
            aria-label="Requested claims"
          >
            {availableClaims.map((claim) => {
              const isApproved = decisions[claim.key] === "approve";
              return (
                <div
                  key={claim.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    borderRadius: tokens.radius.md,
                    border: `1.5px solid ${isApproved ? tokens.color.teal : tokens.color.border}`,
                    background: isApproved
                      ? "rgba(11, 123, 138, 0.04)"
                      : tokens.color.surface,
                    transition: "border-color 0.15s ease, background 0.15s ease",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: 600,
                        color: tokens.color.navy,
                      }}
                    >
                      {claim.label}
                    </div>
                    <div
                      style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.color.textMuted,
                      }}
                    >
                      Value: {claim.value}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleClaim(claim.key)}
                    aria-pressed={isApproved}
                    aria-label={`${claim.label}: ${isApproved ? "Approved" : "Denied"}`}
                    style={{
                      padding: "0.375rem 0.875rem",
                      borderRadius: tokens.radius.full,
                      border: "none",
                      fontSize: tokens.typography.fontSize.xs,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: isApproved
                        ? tokens.color.successLight
                        : tokens.color.errorLight,
                      color: isApproved ? tokens.color.success : tokens.color.error,
                      transition: "background 0.15s ease",
                    }}
                  >
                    {isApproved ? "✓ Approved" : "✕ Denied"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Mandatory Notice (README §7, §17, rule #7) */}
          <div
            role="note"
            style={{
              padding: "0.875rem",
              borderRadius: tokens.radius.md,
              background: tokens.color.warningLight,
              border: `1px solid ${tokens.color.warning}`,
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.color.navyDark,
              lineHeight: tokens.typography.lineHeight.normal,
            }}
          >
            <strong>IMPORTANT CONSENT NOTICE:</strong> Withdrawing consent affects FUTURE
            sharing only; it does not erase data already received by another institution.
            Denied claims are never disclosed.
          </div>
        </CardContent>

        <CardFooter
          style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}
        >
          <Link href="/requests" style={{ textDecoration: "none" }}>
            <Button variant="ghost" disabled={submitting}>
              Decline All & Cancel
            </Button>
          </Link>
          <Button variant="primary" loading={submitting} onClick={handleGrantConsent}>
            Confirm & Record Consent Receipt
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
