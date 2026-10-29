"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Skeleton,
  ErrorState,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

interface QueueItem {
  ticketId: string;
  ticketHash: string;
  category: string;
  detail: Record<string, unknown>;
  status: "applied" | "rejected" | "failed" | "partially_applied" | "pending";
  createdAt: string;
}

export default function BankPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active responding state
  const [selectedTicket, setSelectedTicket] = useState<QueueItem | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState<
    "applied" | "rejected" | "failed" | "partially_applied"
  >("applied");
  const [reasonCode, setReasonCode] = useState<number>(200);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.corrections.getQueue();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setQueue((res.queue as any[]) ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load bank correction queue",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await api.corrections.respond(selectedTicket.ticketId, {
        status: outcomeStatus,
        reasonCode: Number(reasonCode) || 200,
      });

      setSubmitSuccess(
        `Outcome recorded for Apex Trust Bank: ${res.status.toUpperCase()}. Soroban contract updated with institution key.`,
      );
      setSelectedTicket(null);
      await loadQueue();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to record institutional response",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Principle Banner (README §12.4, §18.4, rule #6) */}
      <div
        role="region"
        aria-label="Institution authority policy"
        style={{
          background: tokens.color.surfaceMuted,
          borderLeft: `4px solid ${tokens.color.teal}`,
          padding: "1rem 1.25rem",
          borderRadius: `0 ${tokens.radius.md} ${tokens.radius.md} 0`,
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.color.textPrimary,
          lineHeight: tokens.typography.lineHeight.normal,
        }}
      >
        <strong style={{ color: tokens.color.tealDark }}>
          Institutional Authority Principle (README Rule #6):
        </strong>{" "}
        Authority stays with the institution. Apex Trust Bank updates only its own
        correction status on-chain using its dedicated Stellar keypair. It cannot update
        or alter the status of any other institution.
      </div>

      <Card>
        <CardHeader>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <CardTitle>Bank Identity Update Queue</CardTitle>
              <CardDescription>
                Citizens have requested data updates across their registered accounts.
                Review and record your independent outcome.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadQueue} loading={loading}>
              Refresh Queue
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <Skeleton height="3rem" />
              <Skeleton height="3rem" />
            </div>
          )}

          {error && (
            <ErrorState
              title="Could not load identity update queue"
              message={error}
              onRetry={loadQueue}
            />
          )}

          {!loading && !error && queue.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 1rem",
                color: tokens.color.textSecondary,
                background: tokens.color.surfaceMuted,
                borderRadius: tokens.radius.md,
              }}
            >
              No pending update tickets for Apex Trust Bank.
            </div>
          )}

          {submitSuccess && (
            <div
              role="status"
              style={{
                marginBottom: "1.5rem",
                padding: "1rem",
                borderRadius: tokens.radius.md,
                background: tokens.color.successLight,
                border: `1px solid ${tokens.color.teal}`,
                color: tokens.color.tealDark,
                fontWeight: 600,
                fontSize: tokens.typography.fontSize.sm,
              }}
            >
              ✓ {submitSuccess}
            </div>
          )}

          {!loading && !error && queue.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {queue.map((item) => (
                <div
                  key={item.ticketId}
                  style={{
                    border: `1px solid ${tokens.color.border}`,
                    borderRadius: tokens.radius.md,
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    background: tokens.color.surface,
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
                      <div
                        style={{
                          fontSize: tokens.typography.fontSize.xs,
                          fontFamily: "monospace",
                          color: tokens.color.textSecondary,
                        }}
                      >
                        Ticket ID: {item.ticketId}
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: tokens.typography.fontSize.base,
                          color: tokens.color.navyDark,
                        }}
                      >
                        Category: {item.category.toUpperCase()}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          fontSize: tokens.typography.fontSize.xs,
                          color: tokens.color.textMuted,
                        }}
                      >
                        Current Status:
                      </span>
                      <Badge
                        status={
                          item.status === "applied"
                            ? "applied"
                            : item.status === "rejected"
                              ? "rejected"
                              : item.status === "failed"
                                ? "failed"
                                : item.status === "partially_applied"
                                  ? "partially_applied"
                                  : "submitted"
                        }
                      >
                        {item.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Synthetic Off-Chain Detail */}
                  <div
                    style={{
                      background: tokens.color.surfaceMuted,
                      padding: "0.75rem",
                      borderRadius: tokens.radius.sm,
                      fontSize: tokens.typography.fontSize.xs,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: "0.25rem",
                        color: tokens.color.textSecondary,
                      }}
                    >
                      Off-Chain Synthetic Request Detail:
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      {JSON.stringify(item.detail, null, 2)}
                    </pre>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.color.textMuted,
                      }}
                    >
                      Created: {new Date(item.createdAt).toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setSelectedTicket(item);
                        setSubmitSuccess(null);
                        setSubmitError(null);
                      }}
                    >
                      Respond as Bank
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Modal / Form */}
      {selectedTicket && (
        <Card style={{ border: `2px solid ${tokens.color.teal}` }}>
          <CardHeader>
            <CardTitle>
              Respond to Ticket #{selectedTicket.ticketId.slice(0, 8)}
            </CardTitle>
            <CardDescription>
              Record Apex Trust Bank's independent outcome for this citizen update.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleRespond}>
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
                  Institutional Outcome Status
                </label>
                <select
                  value={outcomeStatus}
                  onChange={(e) =>
                    setOutcomeStatus(
                      e.target.value as
                        | "applied"
                        | "rejected"
                        | "failed"
                        | "partially_applied",
                    )
                  }
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.875rem",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.color.borderStrong}`,
                    fontSize: tokens.typography.fontSize.sm,
                  }}
                >
                  <option value="applied">Applied — Successfully updated records</option>
                  <option value="partially_applied">
                    PartiallyApplied — Secondary check needed
                  </option>
                  <option value="rejected">
                    Rejected — Mismatched synthetic KYC rules
                  </option>
                  <option value="failed">
                    Failed — Institution core banking timeout
                  </option>
                </select>
              </div>

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
                  Status Code / Reason Code
                </label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.875rem",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.color.borderStrong}`,
                    fontSize: tokens.typography.fontSize.sm,
                  }}
                >
                  <option value={200}>200 — Success / Completed</option>
                  <option value={400}>400 — Validation Rejected (Synthetic)</option>
                  <option value={500}>500 — Bank Core Gateway Timeout</option>
                </select>
              </div>

              {submitError && (
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
                  {submitError}
                </div>
              )}
            </CardContent>

            <CardFooter
              style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}
            >
              <Button variant="ghost" onClick={() => setSelectedTicket(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                Sign & Submit On-Chain Outcome
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
