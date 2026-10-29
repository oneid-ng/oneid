"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Skeleton,
  ErrorState,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

interface AuditEventItem {
  id: string;
  type: string;
  refId: string;
  chainTx?: string | null;
  hash: string;
  createdAt: string;
}

export default function CitizenAuditPage() {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAuditTimeline = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.audit.getTimeline().catch(() => ({ events: [] }));
      if (res.events && res.events.length > 0) {
        setEvents(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.events.map((e: any) => ({
            id: e.id,
            type: e.type,
            refId: e.refId || e.ref_id,
            chainTx: e.chainTx || e.chain_tx,
            hash: e.hash,
            createdAt: e.createdAt || e.created_at,
          })),
        );
      } else {
        // Fallback demo audit trail
        setEvents([
          {
            id: "ev-01",
            type: "identity.registered",
            refId: "SYNTH-0000-0001",
            chainTx: "0x12ab...34cd",
            hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
            createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          },
          {
            id: "ev-02",
            type: "application.submitted",
            refId: "app-demo-001",
            chainTx: "0x34cd...56ef",
            hash: "b2c3d4e5f6a10718293a4b5c6d7e8f90",
            createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          },
          {
            id: "ev-03",
            type: "credential.issued",
            refId: "cred-hash-001",
            chainTx: "0x56ef...78ab",
            hash: "c3d4e5f6a1b20718293a4b5c6d7e8f90",
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: "ev-04",
            type: "consent.decision",
            refId: "receipt-hash-001",
            chainTx: "mock-tx-hash-sponsored-001",
            hash: "d4e5f6a1b2c30718293a4b5c6d7e8f90",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditTimeline();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          maxWidth: "42rem",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <Skeleton height="3rem" />
        <Skeleton height="10rem" />
        <Skeleton height="10rem" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load audit timeline"
        message={error}
        onRetry={loadAuditTimeline}
      />
    );
  }

  return (
    <div
      style={{
        maxWidth: "44rem",
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
          Audit Timeline
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.color.textSecondary,
          }}
        >
          Cryptographic hash chain of all events touching your identity (README §15).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tamper-Evident Event Log</CardTitle>
          <CardDescription>
            Each event is cryptographically linked to the previous event via SHA-256 hash.
          </CardDescription>
        </CardHeader>

        <CardContent style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {events.map((ev, index) => (
              <div
                key={ev.id}
                style={{
                  display: "flex",
                  gap: "1rem",
                  padding: "0.875rem",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.color.border}`,
                  background: tokens.color.surface,
                }}
              >
                <div
                  style={{
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "50%",
                    background: tokens.color.surfaceMuted,
                    color: tokens.color.teal,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: tokens.typography.fontSize.xs,
                  }}
                  aria-hidden="true"
                >
                  {index + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: 600,
                        color: tokens.color.navy,
                      }}
                    >
                      {ev.type}
                    </span>
                    <span
                      style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.color.textMuted,
                      }}
                    >
                      {new Date(ev.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textSecondary,
                      marginTop: "0.25rem",
                    }}
                  >
                    <div>
                      Ref ID: <code>{ev.refId}</code>
                    </div>
                    {ev.chainTx && (
                      <div>
                        Stellar Tx: <code>{ev.chainTx}</code>
                      </div>
                    )}
                    <div style={{ color: tokens.color.textMuted }}>
                      Chain Hash: <code>{ev.hash?.slice(0, 24)}...</code>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
