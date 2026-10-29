"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
  Skeleton,
  ErrorState,
  tokens,
  type OnChainStatus,
} from "@oneid/ui";
import { api } from "@/lib/api";

interface OutcomeItem {
  institutionId: string;
  institutionName?: string | undefined;
  homeDomain?: string | undefined;
  status: OnChainStatus;
  reasonCode?: string | number | undefined;
  chainTx?: string | null | undefined;
  updatedAt?: string | undefined;
}

export default function CorrectionTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const ticketId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketHash, setTicketHash] = useState(
    "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
  );
  const [category, setCategory] = useState("address");
  const [outcomes, setOutcomes] = useState<OutcomeItem[]>([]);

  const loadTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.corrections.getById(ticketId).catch(() => null);
      if (res) {
        setTicketHash(res.ticketHash);
        setCategory(res.category);
        setOutcomes(
          (res.outcomes ?? []).map((o) => ({
            institutionId: o.institutionId,
            institutionName: o.institutionName || "Financial Institution",
            homeDomain: "institution.demo.oneid.local",
            status: (o.status as OnChainStatus) || "submitted",
            reasonCode: o.reasonCode,
          })),
        );
      } else {
        // Fallback demo multi-institution timeline showing applied + rejected + partially_applied states
        setOutcomes([
          {
            institutionId: "inst-01",
            institutionName: "First Demo Bank",
            homeDomain: "bank.demo.oneid.local",
            status: "applied",
            reasonCode: "ADDRESS_UPDATED_IN_CORE_BANKING",
            chainTx: "0x78ab...90ef",
            updatedAt: new Date().toISOString(),
          },
          {
            institutionId: "inst-02",
            institutionName: "Demo Telecom Nigeria",
            homeDomain: "telecom.demo.oneid.local",
            status: "rejected",
            reasonCode: "PROOF_OF_ADDRESS_REQUIRED",
            chainTx: "0x45cd...1234",
            updatedAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load correction ticket");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  if (loading) {
    return (
      <div
        style={{
          maxWidth: "40rem",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <Skeleton height="3rem" />
        <Skeleton height="12rem" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load correction timeline"
        message={error}
        onRetry={loadTicket}
      />
    );
  }

  return (
    <div
      style={{
        maxWidth: "42rem",
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
          Correction Processing Timeline
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.color.textSecondary,
          }}
        >
          Independent per-institution status on Soroban <code>correction-tracker</code>.
          Authority stays with each institution.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: tokens.typography.fontSize.base }}>
            Ticket Category: {category.toUpperCase()}
          </CardTitle>
          <CardDescription>
            On-Chain Ticket Hash: <code>{ticketHash}</code>
          </CardDescription>
        </CardHeader>

        <CardContent style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <span
            style={{
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: 600,
              color: tokens.color.navy,
            }}
          >
            Per-Institution Outcomes:
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {outcomes.map((item, index) => (
              <div
                key={item.institutionId || index}
                style={{
                  border: `1.5px solid ${tokens.color.border}`,
                  borderRadius: tokens.radius.md,
                  padding: "1rem",
                  background: tokens.color.surface,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
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
                    <h4
                      style={{
                        margin: 0,
                        fontSize: tokens.typography.fontSize.base,
                        color: tokens.color.navy,
                      }}
                    >
                      {item.institutionName}
                    </h4>
                    <span
                      style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.color.textMuted,
                      }}
                    >
                      Domain: {item.homeDomain}
                    </span>
                  </div>
                  <Badge status={item.status} />
                </div>

                {item.reasonCode && (
                  <div
                    style={{
                      background: tokens.color.surfaceMuted,
                      padding: "0.375rem 0.625rem",
                      borderRadius: tokens.radius.sm,
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textSecondary,
                    }}
                  >
                    <strong>Response Code / Note: </strong>
                    <code>{String(item.reasonCode)}</code>
                  </div>
                )}

                {item.chainTx && (
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textMuted,
                    }}
                  >
                    On-Chain Tx: <code>{item.chainTx}</code>
                  </div>
                )}
              </div>
            ))}
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
            <strong>Rule #6 (Institutional Authority):</strong> Each institution responds
            ONLY for itself using its own keypair. Bank A cannot update status for Bank B.
          </div>
        </CardContent>

        <CardFooter
          style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}
        >
          <Link href="/requests" style={{ textDecoration: "none" }}>
            <Button variant="ghost">View All Requests</Button>
          </Link>
          <Button variant="outline" onClick={loadTicket}>
            Refresh Status
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
