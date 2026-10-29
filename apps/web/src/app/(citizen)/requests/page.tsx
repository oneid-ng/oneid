"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  Badge,
  Button,
  Skeleton,
  ErrorState,
  tokens,
  type OnChainStatus,
} from "@oneid/ui";
import { api } from "@/lib/api";

type TabType = "all" | "updates" | "sharing" | "verifications";

interface RequestItem {
  id: string;
  type: "update" | "sharing" | "verification";
  title: string;
  subtitle: string;
  status: OnChainStatus;
  timestamp: string;
  link: string;
}

export default function MyRequestsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RequestItem[]>([]);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, consentsRes] = await Promise.all([
        api.requests.getPending().catch(() => ({ requests: [] })),
        api.consents.list().catch(() => ({ consents: [] })),
      ]);

      const sharingItems: RequestItem[] = (pendingRes.requests ?? []).map(
        (r: Record<string, unknown>) => ({
          id: String(r["id"]),
          type: "sharing",
          title: String(r["purpose"] || "Verification Request"),
          subtitle: String(r["verifierDomain"] || "Authorised Verifier"),
          status: "submitted",
          timestamp: String(r["created_at"] || new Date().toISOString()),
          link: `/consent/${r["id"]}`,
        }),
      );

      const consentReceiptItems: RequestItem[] = (consentsRes.consents ?? []).map(
        (c: Record<string, unknown>) => ({
          id: String(c["id"] || c["receipt_hash"]),
          type: "sharing",
          title: "Consent Receipt Granted",
          subtitle: `Receipt: ${String(c["receipt_hash"] || "").slice(0, 16)}...`,
          status: (c["status"] as OnChainStatus) || "active",
          timestamp: String(c["created_at"] || new Date().toISOString()),
          link: `/consent/receipt/${c["receipt_hash"]}`,
        }),
      );

      const defaultDemoItems: RequestItem[] = [
        {
          id: "demo-req-1",
          type: "sharing",
          title: "Tier 2 Bank Account Opening",
          subtitle: "First Demo Bank (bank.demo.oneid.local)",
          status: "submitted",
          timestamp: new Date().toISOString(),
          link: "/consent/demo",
        },
        {
          id: "demo-corr-1",
          type: "update",
          title: "Address Correction Ticket",
          subtitle: "Target: First Demo Bank & Demo Telecom",
          status: "partially_applied",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          link: "/corrections/demo",
        },
        {
          id: "demo-verif-1",
          type: "verification",
          title: "Subscriber Verification Presentation",
          subtitle: "Demo Telecom Nigeria",
          status: "applied",
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          link: "/digital-id",
        },
      ];

      const all = [...sharingItems, ...consentReceiptItems];
      setItems(all.length > 0 ? all : defaultDemoItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredItems = items.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "updates") return item.type === "update";
    if (activeTab === "sharing") return item.type === "sharing";
    if (activeTab === "verifications") return item.type === "verification";
    return true;
  });

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
          My Requests
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.color.textSecondary,
          }}
        >
          Manage your sharing authorisations, correction tickets, and verifications.
        </p>
      </div>

      {error && (
        <ErrorState
          title="Could not load requests"
          message={error}
          onRetry={loadRequests}
        />
      )}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Request categories"
        style={{
          display: "flex",
          borderBottom: `2px solid ${tokens.color.border}`,
          gap: "1rem",
        }}
      >
        {(["all", "updates", "sharing", "verifications"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const labels: Record<TabType, string> = {
            all: "All Requests",
            updates: "Updates",
            sharing: "Sharing & Consent",
            verifications: "Verifications",
          };

          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.625rem 0.25rem",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${isActive ? tokens.color.teal : "transparent"}`,
                marginBottom: "-2px",
                fontFamily: tokens.typography.fontFamily,
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? tokens.color.teal : tokens.color.textMuted,
                cursor: "pointer",
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Skeleton height="5rem" />
          <Skeleton height="5rem" />
          <Skeleton height="5rem" />
        </div>
      ) : filteredItems.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "2rem" }}>
          <p
            style={{
              margin: 0,
              color: tokens.color.textMuted,
              fontSize: tokens.typography.fontSize.sm,
            }}
          >
            No requests found in this category.
          </p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filteredItems.map((item) => (
            <Card key={item.id}>
              <CardContent
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  padding: "0.5rem 0",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: tokens.typography.fontSize.base,
                        color: tokens.color.navy,
                      }}
                    >
                      {item.title}
                    </h4>
                    <Badge status={item.status} />
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textMuted,
                      marginTop: "0.25rem",
                    }}
                  >
                    {item.subtitle} · {new Date(item.timestamp).toLocaleDateString()}
                  </div>
                </div>

                <Link href={item.link}>
                  <Button variant="outline" size="sm">
                    View Details →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
