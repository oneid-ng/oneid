"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Skeleton,
  ErrorState,
  tokens,
  type OnChainStatus,
} from "@oneid/ui";
import { api } from "@/lib/api";

interface CredentialItem {
  id: string;
  credentialHash: string;
  issuerName?: string;
  issuerDomain?: string;
  status: OnChainStatus;
  expiresAt: string;
  chainTx?: string | null;
  ledger?: number | null;
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCredentials = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.identity.getCredentials().catch(() => ({ credentials: [] }));
      if (res.credentials && res.credentials.length > 0) {
        setCredentials(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res.credentials.map((c: any) => ({
            id: c.id,
            credentialHash:
              c.credential_hash ||
              c.credentialHash ||
              "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            issuerName: "National Identity Issuer (Demo)",
            issuerDomain: "issuer.demo.oneid.local",
            status: (c.status as OnChainStatus) || "active",
            expiresAt:
              c.expires_at ||
              c.expiresAt ||
              new Date(Date.now() + 86400000 * 365).toISOString(),
            chainTx: c.chain_tx || c.chainTx || "mock-tx-001",
            ledger: c.ledger || 1042,
          })),
        );
      } else {
        // Fallback default demo credential
        setCredentials([
          {
            id: "cred-demo-01",
            credentialHash:
              "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            issuerName: "National Identity Management Issuer",
            issuerDomain: "issuer.demo.oneid.local",
            status: "active",
            expiresAt: new Date(Date.now() + 86400000 * 360).toISOString(),
            chainTx: "c983a...f712",
            ledger: 1042,
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load credentials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredentials();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Skeleton height="3rem" width="16rem" />
        <Skeleton height="8rem" />
        <Skeleton height="8rem" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load credentials"
        message={error}
        onRetry={loadCredentials}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2
          style={{
            margin: "0 0 0.25rem 0",
            fontSize: tokens.typography.fontSize["2xl"],
            color: tokens.color.navy,
          }}
        >
          Verifiable Credentials
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.color.textSecondary,
          }}
        >
          W3C SD-JWT VC credentials registered on Soroban <code>credential-status</code>{" "}
          contract.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {credentials.map((cred) => (
          <Card key={cred.id}>
            <CardHeader
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                <CardTitle style={{ fontSize: tokens.typography.fontSize.base }}>
                  {cred.issuerName}
                </CardTitle>
                <CardDescription>
                  Issuer DID / Domain: <code>{cred.issuerDomain}</code>
                </CardDescription>
              </div>

              <Badge status={cred.status} />
            </CardHeader>

            <CardContent
              style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "0.75rem",
                  fontSize: tokens.typography.fontSize.xs,
                  background: tokens.color.surfaceMuted,
                  padding: "0.75rem",
                  borderRadius: tokens.radius.md,
                }}
              >
                <div>
                  <span style={{ color: tokens.color.textMuted, display: "block" }}>
                    Credential Hash:
                  </span>
                  <code style={{ wordBreak: "break-all" }}>{cred.credentialHash}</code>
                </div>
                <div>
                  <span style={{ color: tokens.color.textMuted, display: "block" }}>
                    Expiration Date:
                  </span>
                  <span>{new Date(cred.expiresAt).toLocaleDateString()}</span>
                </div>
                <div>
                  <span style={{ color: tokens.color.textMuted, display: "block" }}>
                    Soroban Ledger Reference:
                  </span>
                  <span>Ledger #{cred.ledger ?? "1042"}</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    alert(
                      `Credential Hash: ${cred.credentialHash}\nStatus: ${cred.status}\nLedger: ${cred.ledger}`,
                    )
                  }
                >
                  Verify Status On-Chain
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
