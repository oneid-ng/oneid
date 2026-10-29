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
  Input,
  Badge,
  Skeleton,
  ErrorState,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

interface ApplicationRecord {
  id: string;
  applicant_user_id: string;
  status: string;
  decision_notes?: string;
  created_at: string;
}

export default function IssuerPage() {
  const [activeTab, setActiveTab] = useState<"applications" | "issue" | "revoke">(
    "applications",
  );

  // Applications review state
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [actingAppId, setActingAppId] = useState<string | null>(null);

  // Issuance wizard state
  const [holderUserId, setHolderUserId] = useState("synthetic-user-holder-01");
  const [selectedClaims, setSelectedClaims] = useState<Record<string, boolean>>({
    over18: true,
    kycTier: true,
    ninHash: true,
    bvnHash: false,
    faceMatchHash: false,
  });
  const [validityDays, setValidityDays] = useState(365);
  const [issuing, setIssuing] = useState(false);
  const [issueResult, setIssueResult] = useState<{
    id: string;
    credentialHash: string;
    sdJwt: string;
    expiresAt: string;
  } | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Revocation state
  const [revokeHash, setRevokeHash] = useState("");
  const [revokeReason, setRevokeReason] = useState(1);
  const [revoking, setRevoking] = useState(false);
  const [revokeResult, setRevokeResult] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const loadApplications = async () => {
    setAppsLoading(true);
    setAppsError(null);
    try {
      const res = await api.identity.getApplications();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setApplications((res.applications as any[]) ?? []);
    } catch (err) {
      setAppsError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setAppsLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const handleDecision = async (id: string, decision: "approved" | "rejected") => {
    setActingAppId(id);
    try {
      await api.identity.decideApplication(id, {
        decision,
        note: `Synthetic issuer decision: ${decision}`,
      });
      await loadApplications();
    } catch (err) {
      alert(`Decision failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActingAppId(null);
    }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssuing(true);
    setIssueError(null);
    setIssueResult(null);

    const claimsToIssue = Object.entries(selectedClaims)
      .filter(([, active]) => active)
      .map(([claim]) => claim);

    if (claimsToIssue.length === 0) {
      setIssueError("Select at least one claim attribute to issue.");
      setIssuing(false);
      return;
    }

    try {
      const result = await api.issuance.issue({
        holderUserId: holderUserId.trim(),
        claims: claimsToIssue,
        validityDays: Number(validityDays) || 365,
      });
      setIssueResult(result);
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : "Issuance failed");
    } finally {
      setIssuing(false);
    }
  };

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeHash.trim()) {
      setRevokeError("Credential hash is required.");
      return;
    }
    setRevoking(true);
    setRevokeError(null);
    setRevokeResult(null);

    try {
      const res = await api.issuance.revoke(revokeHash.trim(), {
        reasonCode: revokeReason,
      });
      setRevokeResult(
        `Credential ${res.hash.slice(0, 16)}... successfully revoked on-chain.`,
      );
      setRevokeHash("");
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : "Revocation failed");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Portal Navigation Tabs */}
      <nav
        aria-label="Issuer portal navigation"
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: `1px solid ${tokens.color.border}`,
          paddingBottom: "0.5rem",
        }}
      >
        <Button
          variant={activeTab === "applications" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("applications")}
        >
          Applications Review ({applications.length})
        </Button>
        <Button
          variant={activeTab === "issue" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("issue")}
        >
          Issue W3C SD-JWT Credential
        </Button>
        <Button
          variant={activeTab === "revoke" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("revoke")}
        >
          Revoke Credential
        </Button>
      </nav>

      {/* ── TAB 1: APPLICATIONS REVIEW ── */}
      {activeTab === "applications" && (
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
                <CardTitle>Citizen Applications Queue</CardTitle>
                <CardDescription>
                  Review submitted KYC verification requests and decide approval.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadApplications}
                loading={appsLoading}
              >
                Refresh
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {appsLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Skeleton height="3rem" />
                <Skeleton height="3rem" />
              </div>
            )}

            {appsError && (
              <ErrorState
                title="Could not load applications"
                message={appsError}
                onRetry={loadApplications}
              />
            )}

            {!appsLoading && !appsError && applications.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  color: tokens.color.textSecondary,
                  background: tokens.color.surfaceMuted,
                  borderRadius: tokens.radius.md,
                }}
              >
                No pending applications in the queue.
              </div>
            )}

            {!appsLoading && !appsError && applications.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}
                >
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${tokens.color.border}` }}>
                      <th style={{ padding: "0.75rem" }}>Application ID</th>
                      <th style={{ padding: "0.75rem" }}>Applicant Holder</th>
                      <th style={{ padding: "0.75rem" }}>Status</th>
                      <th style={{ padding: "0.75rem" }}>Submitted</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr
                        key={app.id}
                        style={{ borderBottom: `1px solid ${tokens.color.border}` }}
                      >
                        <td
                          style={{
                            padding: "0.75rem",
                            fontFamily: "monospace",
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {app.id.slice(0, 12)}...
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontFamily: "monospace",
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {app.applicant_user_id.slice(0, 12)}...
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <Badge
                            status={
                              app.status === "approved"
                                ? "active"
                                : app.status === "rejected"
                                  ? "revoked"
                                  : "submitted"
                            }
                          >
                            {app.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.color.textSecondary,
                          }}
                        >
                          {new Date(app.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "0.75rem", textAlign: "right" }}>
                          {app.status === "pending" ? (
                            <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                              <Button
                                size="sm"
                                variant="primary"
                                loading={actingAppId === app.id}
                                onClick={() => handleDecision(app.id, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                loading={actingAppId === app.id}
                                onClick={() => handleDecision(app.id, "rejected")}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span
                              style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.color.textMuted,
                              }}
                            >
                              Decision recorded
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── TAB 2: CREDENTIAL ISSUANCE WIZARD ── */}
      {activeTab === "issue" && (
        <Card>
          <CardHeader>
            <CardTitle>Issue W3C SD-JWT Credential</CardTitle>
            <CardDescription>
              Sign and issue selective disclosure credentials anchored to Stellar Soroban
              registry.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleIssue}>
            <CardContent
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >
              <Input
                label="Holder User ID / Subject Identifier"
                value={holderUserId}
                onChange={(e) => setHolderUserId(e.target.value)}
                hint="Synthetic citizen account UUID."
                required
              />

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
                  Disclosable Attributes (Selective Disclosure Claims)
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "0.75rem",
                    background: tokens.color.surfaceMuted,
                    padding: "1rem",
                    borderRadius: tokens.radius.md,
                  }}
                >
                  {[
                    { key: "over18", label: "Age Verification (over18)" },
                    { key: "kycTier", label: "KYC Tier Level (tier1 / tier2)" },
                    { key: "ninHash", label: "NIN Salted Canonical Hash" },
                    { key: "bvnHash", label: "BVN Salted Canonical Hash" },
                    {
                      key: "faceMatchHash",
                      label: "Biometric Liveness Verification Hash",
                    },
                  ].map(({ key, label }) => (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: tokens.typography.fontSize.sm,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedClaims[key] ?? false}
                        onChange={(e) =>
                          setSelectedClaims((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                          }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Input
                label="Validity Period (Days)"
                type="number"
                min="1"
                max="1825"
                value={String(validityDays)}
                onChange={(e) => setValidityDays(Number(e.target.value))}
                hint="Default validity is 365 days (1 year)."
              />

              {issueError && (
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
                  {issueError}
                </div>
              )}

              {issueResult && (
                <div
                  role="status"
                  style={{
                    padding: "1rem",
                    background: tokens.color.successLight,
                    border: `1px solid ${tokens.color.teal}`,
                    borderRadius: tokens.radius.md,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ fontWeight: 700, color: tokens.color.tealDark }}>
                    ✓ Credential Successfully Issued & Anchored On-Chain
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    <strong>Credential Hash:</strong> {issueResult.credentialHash}
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    <strong>SD-JWT Token (First 64 chars):</strong>{" "}
                    {issueResult.sdJwt.slice(0, 64)}...
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textSecondary,
                    }}
                  >
                    Expires: {new Date(issueResult.expiresAt).toLocaleDateString()}
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter>
              <Button type="submit" variant="primary" loading={issuing}>
                Sign & Issue Credential
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* ── TAB 3: REVOKE CREDENTIAL ── */}
      {activeTab === "revoke" && (
        <Card>
          <CardHeader>
            <CardTitle style={{ color: tokens.color.error }}>
              Revoke Credential On-Chain
            </CardTitle>
            <CardDescription>
              Mark a credential revoked on the Soroban credential-status contract. Fails
              closed immediately.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleRevoke}>
            <CardContent
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >
              <Input
                label="Target Credential Canonical Hash"
                value={revokeHash}
                onChange={(e) => setRevokeHash(e.target.value)}
                placeholder="64-character hex hash"
                hint="Enter the SHA-256 hash of the credential to revoke."
                required
              />

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
                  Revocation Reason Code
                </label>
                <select
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.875rem",
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.color.borderStrong}`,
                    fontSize: tokens.typography.fontSize.sm,
                  }}
                >
                  <option value={1}>1 — Unspecified / Routine Maintenance</option>
                  <option value={2}>2 — Superseded by New Issuance</option>
                  <option value={3}>3 — Key Compromise or Security Alert</option>
                  <option value={4}>4 — Cease of Operations</option>
                </select>
              </div>

              {revokeError && (
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
                  {revokeError}
                </div>
              )}

              {revokeResult && (
                <div
                  role="status"
                  style={{
                    padding: "1rem",
                    background: tokens.color.errorLight,
                    border: `1px solid ${tokens.color.error}`,
                    borderRadius: tokens.radius.md,
                    color: tokens.color.error,
                    fontWeight: 600,
                    fontSize: tokens.typography.fontSize.sm,
                  }}
                >
                  ✓ {revokeResult}
                </div>
              )}
            </CardContent>

            <CardFooter>
              <Button type="submit" variant="danger" loading={revoking}>
                Revoke on Soroban Contract
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
