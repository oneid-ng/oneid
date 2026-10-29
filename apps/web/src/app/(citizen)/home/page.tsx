"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Skeleton,
  ErrorState,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

export default function CitizenHomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<Array<Record<string, unknown>>>(
    [],
  );
  const [credentialCount, setCredentialCount] = useState(1);
  const [consentCount, setConsentCount] = useState(0);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqData, credData, consentData] = await Promise.all([
        api.requests.getPending().catch(() => ({ requests: [] })),
        api.identity.getCredentials().catch(() => ({ credentials: [{ id: "mock" }] })),
        api.consents.list().catch(() => ({ consents: [] })),
      ]);

      setPendingRequests(reqData.requests ?? []);
      setCredentialCount((credData.credentials ?? []).length || 1);
      setConsentCount((consentData.consents ?? []).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <Skeleton height="10rem" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <Skeleton height="6rem" />
          <Skeleton height="6rem" />
          <Skeleton height="6rem" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load your identity dashboard"
        message={error}
        onRetry={loadDashboardData}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Pending Request Alert (if any) */}
      {pendingRequests.length > 0 && (
        <div
          role="alert"
          style={{
            background: tokens.color.infoLight,
            border: `1.5px solid ${tokens.color.info}`,
            borderRadius: tokens.radius.lg,
            padding: "1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <div>
            <h4
              style={{
                margin: "0 0 0.25rem 0",
                color: tokens.color.info,
                fontSize: tokens.typography.fontSize.base,
                fontWeight: 600,
              }}
            >
              Action Required: Pending KYC Request
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.color.textPrimary,
              }}
            >
              An authorised institution has requested selective disclosure of your
              identity attributes.
            </p>
          </div>
          <Link href={`/consent/${pendingRequests[0]?.["id"] ?? "demo"}`}>
            <Button variant="secondary" size="sm">
              Review Request
            </Button>
          </Link>
        </div>
      )}

      {/* Identity Summary Card */}
      <Card
        variant="bordered"
        style={{
          background: tokens.color.navy,
          color: tokens.color.textInverse,
          border: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.color.goldLight,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            >
              Reusable Digital KYC
            </span>
            <h2
              style={{
                margin: "0.25rem 0 0.5rem 0",
                fontSize: tokens.typography.fontSize["2xl"],
                fontWeight: 700,
              }}
            >
              Adaeze Okonkwo
            </h2>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Badge status="active">Active On-Chain</Badge>
              <span
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.color.offWhite,
                }}
              >
                Tier 2 Verified
              </span>
              <span
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.color.goldLight,
                }}
              >
                Fee-Sponsored Wallet (0 XLM Balance)
              </span>
            </div>
          </div>

          <Link href="/digital-id">
            <Button
              variant="outline"
              size="sm"
              style={{
                borderColor: tokens.color.gold,
                color: tokens.color.gold,
              }}
            >
              View Digital ID & QR
            </Button>
          </Link>
        </div>
      </Card>

      {/* Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        <Card>
          <CardHeader>
            <CardDescription>Verified Credentials</CardDescription>
            <CardTitle style={{ fontSize: tokens.typography.fontSize["2xl"] }}>
              {credentialCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/credentials"
              style={{ fontSize: tokens.typography.fontSize.xs, fontWeight: 600 }}
            >
              Manage credentials →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Active Consent Receipts</CardDescription>
            <CardTitle style={{ fontSize: tokens.typography.fontSize["2xl"] }}>
              {consentCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/requests"
              style={{ fontSize: tokens.typography.fontSize.xs, fontWeight: 600 }}
            >
              View sharing history →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Record Updates</CardDescription>
            <CardTitle style={{ fontSize: tokens.typography.fontSize["2xl"] }}>
              0
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/corrections/new"
              style={{ fontSize: tokens.typography.fontSize.xs, fontWeight: 600 }}
            >
              Request update →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common citizen self-sovereign identity workflows
          </CardDescription>
        </CardHeader>
        <CardContent style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/digital-id">
            <Button variant="secondary" size="md">
              Share Identity Card
            </Button>
          </Link>
          <Link href="/corrections/new">
            <Button variant="outline" size="md">
              Update Address or Phone
            </Button>
          </Link>
          <Link href="/audit">
            <Button variant="ghost" size="md">
              View Verified Audit Trail
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
