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
  Skeleton,
  ErrorState,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

const REASON_EXPLANATIONS: Record<string, string> = {
  CONSENT_MISSING:
    "No active on-chain consent receipt found for this request and holder.",
  CONSENT_EXPIRED: "The citizen's consent receipt has reached its expiration timestamp.",
  CONSENT_WITHDRAWN: "The citizen has explicitly withdrawn their consent on-chain.",
  CREDENTIAL_REVOKED:
    "The credential has been marked Revoked on the Soroban credential registry.",
  CREDENTIAL_EXPIRED: "The credential validity period has elapsed.",
  ISSUER_NOT_ACTIVE: "The issuing institution is suspended or not registered on-chain.",
  INVALID_ISSUER_SIGNATURE:
    "The issuer cryptographic signature on the SD-JWT could not be verified.",
  INVALID_HOLDER_BINDING:
    "The key binding signature does not match the registered holder.",
  AUDIENCE_MISMATCH:
    "The presentation was created for a different relying party audience.",
  NONCE_MISMATCH:
    "The presentation nonce does not match the active verification challenge.",
};

export default function VerifierPage() {
  const [activeTab, setActiveTab] = useState<"new-request" | "verify" | "audit">(
    "new-request",
  );

  // New Request State
  const [requesterName, setRequesterName] = useState("Apex Trust Bank");
  const [purpose, setPurpose] = useState("Tier 2 Account Opening KYC Verification");
  const [claimsNeeded, setClaimsNeeded] = useState<Record<string, boolean>>({
    over18: true,
    kycTier: true,
    ninHash: true,
    bvnHash: false,
  });
  const [expiryMinutes, setExpiryMinutes] = useState(60);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<{
    id: string;
    nonce: string;
    status: string;
  } | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Verify Presentation State
  const [presentationJwt, setPresentationJwt] = useState("");
  const [audienceDomain, setAudienceDomain] = useState("bank.demo.oneid.local");
  const [nonceInput, setNonceInput] = useState("");
  const [consentReceiptHash, setConsentReceiptHash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    code: string;
    claims?: Record<string, unknown>;
    holder?: string;
    issuer?: string;
    reason?: string;
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Audit Logs State
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [auditError, setAuditError] = useState<string | null>(null);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingRequest(true);
    setRequestError(null);
    setCreatedRequest(null);

    const claims = Object.entries(claimsNeeded)
      .filter(([, active]) => active)
      .map(([claim]) => claim);

    if (claims.length === 0) {
      setRequestError("Select at least one required claim.");
      setCreatingRequest(false);
      return;
    }

    try {
      const res = await api.requests.create({
        holderRef: "synthetic-citizen-01",
        claims,
        purpose: purpose.trim(),
        expiresInSeconds: expiryMinutes * 60,
      });
      setCreatedRequest(res);
      setNonceInput(res.nonce);
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : "Failed to create verification request",
      );
    } finally {
      setCreatingRequest(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setVerifyError(null);
    setVerificationResult(null);

    try {
      const res = await api.verification.verifyPresentation({
        presentation: presentationJwt.trim(),
        expectedAudience: audienceDomain.trim(),
        expectedNonce: nonceInput.trim(),
        consentReceiptHash: consentReceiptHash.trim()
          ? consentReceiptHash.trim()
          : undefined,
      });
      setVerificationResult(res);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification request failed");
    } finally {
      setVerifying(false);
    }
  };

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await api.audit.getTimeline();
      setAuditLogs(res.events ?? []);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "audit") {
      loadAuditLogs();
    }
  }, [activeTab]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Navigation Tabs */}
      <nav
        aria-label="Verifier navigation"
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: `1px solid ${tokens.color.border}`,
          paddingBottom: "0.5rem",
        }}
      >
        <Button
          variant={activeTab === "new-request" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("new-request")}
        >
          New Verification Request
        </Button>
        <Button
          variant={activeTab === "verify" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("verify")}
        >
          Verify Presentation & Result
        </Button>
        <Button
          variant={activeTab === "audit" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("audit")}
        >
          Audit Log
        </Button>
      </nav>

      {/* ── TAB 1: NEW REQUEST ── */}
      {activeTab === "new-request" && (
        <Card>
          <CardHeader>
            <CardTitle>Initiate KYC Verification Request</CardTitle>
            <CardDescription>
              Specify the exact attributes needed and the legally binding purpose for data
              processing.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleCreateRequest}>
            <CardContent
              style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
            >
              <Input
                label="Relying Party / Organization Name"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                required
              />

              <Input
                label="Processing Purpose (Specific & Explicit)"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                hint="Under Nigeria NDPA 2023 principles, consent must be specific to this exact purpose."
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
                  Requested Claims (Minimised Selective Disclosure)
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
                        checked={claimsNeeded[key] ?? false}
                        onChange={(e) =>
                          setClaimsNeeded((prev) => ({
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
                label="Request Expiry (Minutes)"
                type="number"
                min="5"
                max="10080"
                value={String(expiryMinutes)}
                onChange={(e) => setExpiryMinutes(Number(e.target.value))}
                hint="Requests expire automatically if unapproved."
              />

              {requestError && (
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
                  {requestError}
                </div>
              )}

              {createdRequest && (
                <div
                  role="status"
                  style={{
                    padding: "1.25rem",
                    background: tokens.color.successLight,
                    border: `1px solid ${tokens.color.teal}`,
                    borderRadius: tokens.radius.md,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ fontWeight: 700, color: tokens.color.tealDark }}>
                    ✓ Verification Request Created Successfully
                  </div>
                  <div style={{ fontSize: tokens.typography.fontSize.sm }}>
                    <strong>Request ID:</strong> <code>{createdRequest.id}</code>
                  </div>
                  <div style={{ fontSize: tokens.typography.fontSize.sm }}>
                    <strong>Challenge Nonce:</strong> <code>{createdRequest.nonce}</code>
                  </div>
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textSecondary,
                    }}
                  >
                    Citizen Consent Link: <code>/consent/{createdRequest.id}</code>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter>
              <Button type="submit" variant="primary" loading={creatingRequest}>
                Generate Verification Request
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* ── TAB 2: VERIFY PRESENTATION & RESULTS SCREEN ── */}
      {activeTab === "verify" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <Card>
            <CardHeader>
              <CardTitle>Verify W3C SD-JWT Presentation</CardTitle>
              <CardDescription>
                Fail-closed verification: checks cryptographic signature, holder binding,
                audience, nonce, active issuer on Soroban, active credential status, and
                active consent receipt.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleVerify}>
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
                    SD-JWT Presentation Token
                  </label>
                  <textarea
                    rows={4}
                    value={presentationJwt}
                    onChange={(e) => setPresentationJwt(e.target.value)}
                    placeholder="eyJhbGciOiJFUzI1NiIs..."
                    style={{
                      width: "100%",
                      fontFamily: "monospace",
                      fontSize: tokens.typography.fontSize.xs,
                      padding: "0.75rem",
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.borderStrong}`,
                    }}
                    required
                  />
                </div>

                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}
                >
                  <Input
                    label="Audience Home Domain"
                    value={audienceDomain}
                    onChange={(e) => setAudienceDomain(e.target.value)}
                    required
                  />
                  <Input
                    label="Expected Nonce"
                    value={nonceInput}
                    onChange={(e) => setNonceInput(e.target.value)}
                    placeholder="32-char hex nonce"
                    required
                  />
                </div>

                <Input
                  label="On-Chain Consent Receipt Hash (Optional for standalone check)"
                  value={consentReceiptHash}
                  onChange={(e) => setConsentReceiptHash(e.target.value)}
                  placeholder="64-character hex receipt hash"
                />

                {verifyError && (
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
                    {verifyError}
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button type="submit" variant="primary" loading={verifying}>
                  Run Comprehensive Verification
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Result Screen */}
          {verificationResult && (
            <Card
              style={{
                border: `2px solid ${verificationResult.verified ? tokens.color.teal : tokens.color.error}`,
              }}
            >
              <CardHeader>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <CardTitle
                    style={{
                      color: verificationResult.verified
                        ? tokens.color.teal
                        : tokens.color.error,
                    }}
                  >
                    Verification Result:{" "}
                    {verificationResult.verified ? "VERIFIED (VALID)" : "DENIED"}
                  </CardTitle>
                  <span
                    style={{
                      padding: "0.25rem 0.75rem",
                      borderRadius: tokens.radius.sm,
                      fontFamily: "monospace",
                      fontWeight: 700,
                      fontSize: tokens.typography.fontSize.xs,
                      background: verificationResult.verified
                        ? tokens.color.tealLight
                        : tokens.color.errorLight,
                      color: verificationResult.verified
                        ? tokens.color.tealDark
                        : tokens.color.error,
                    }}
                  >
                    CODE: {verificationResult.code}
                  </span>
                </div>
                <CardDescription>
                  {verificationResult.verified
                    ? "All cryptographic and on-chain Soroban conditions passed successfully."
                    : REASON_EXPLANATIONS[verificationResult.code] ||
                      verificationResult.reason ||
                      "Verification rejected under fail-closed security rules."}
                </CardDescription>
              </CardHeader>

              <CardContent
                style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
              >
                {verificationResult.verified && verificationResult.claims && (
                  <div>
                    <h4
                      style={{
                        margin: "0 0 0.5rem 0",
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.color.textSecondary,
                      }}
                    >
                      Disclosed & Verified Claims
                    </h4>
                    <div
                      style={{
                        background: tokens.color.surfaceMuted,
                        padding: "1rem",
                        borderRadius: tokens.radius.md,
                        fontFamily: "monospace",
                        fontSize: tokens.typography.fontSize.xs,
                      }}
                    >
                      <pre style={{ margin: 0 }}>
                        {JSON.stringify(verificationResult.claims, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {!verificationResult.verified && (
                  <div
                    style={{
                      background: tokens.color.errorLight,
                      padding: "1rem",
                      borderRadius: tokens.radius.md,
                      color: tokens.color.error,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
                      Denied Reason Code: <code>{verificationResult.code}</code>
                    </div>
                    <div style={{ fontSize: tokens.typography.fontSize.sm }}>
                      {REASON_EXPLANATIONS[verificationResult.code] ||
                        "Request denied by registry or consent policy."}
                    </div>
                  </div>
                )}

                {verificationResult.holder && (
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textSecondary,
                    }}
                  >
                    Holder Subject: <code>{verificationResult.holder}</code>
                  </div>
                )}
                {verificationResult.issuer && (
                  <div
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textSecondary,
                    }}
                  >
                    Issuer Authority: <code>{verificationResult.issuer}</code>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB 3: AUDIT LOG ── */}
      {activeTab === "audit" && (
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
                <CardTitle>Verifier Audit Log</CardTitle>
                <CardDescription>
                  Append-only immutable record of presentations and verification events.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAuditLogs}
                loading={auditLoading}
              >
                Refresh
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {auditLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Skeleton height="3rem" />
                <Skeleton height="3rem" />
              </div>
            )}

            {auditError && (
              <ErrorState
                title="Could not load audit events"
                message={auditError}
                onRetry={loadAuditLogs}
              />
            )}

            {!auditLoading && !auditError && auditLogs.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  color: tokens.color.textSecondary,
                  background: tokens.color.surfaceMuted,
                  borderRadius: tokens.radius.md,
                }}
              >
                No audit events recorded yet.
              </div>
            )}

            {!auditLoading && !auditError && auditLogs.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}
                >
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${tokens.color.border}` }}>
                      <th style={{ padding: "0.75rem" }}>Event Type</th>
                      <th style={{ padding: "0.75rem" }}>Reference ID</th>
                      <th style={{ padding: "0.75rem" }}>Chain Tx</th>
                      <th style={{ padding: "0.75rem" }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((ev, i) => (
                      <tr
                        key={String(ev["id"] ?? i)}
                        style={{ borderBottom: `1px solid ${tokens.color.border}` }}
                      >
                        <td
                          style={{
                            padding: "0.75rem",
                            fontWeight: 600,
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {String(ev["type"] ?? "VERIFICATION_EVENT")}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontFamily: "monospace",
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {String(ev["ref_id"] ?? "N/A").slice(0, 16)}...
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontFamily: "monospace",
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {ev["chain_tx"]
                            ? `${String(ev["chain_tx"]).slice(0, 12)}...`
                            : "Off-chain"}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.color.textSecondary,
                          }}
                        >
                          {ev["created_at"]
                            ? new Date(String(ev["created_at"])).toLocaleTimeString()
                            : "Recent"}
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
    </div>
  );
}
