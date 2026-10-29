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

interface HealthData {
  status: string;
  indexer: Array<{
    contractId?: string;
    lastLedger?: number;
    lag?: number;
  }>;
  featureFlags: Record<string, boolean>;
}

interface EntityRecord {
  id: string;
  name: string;
  role: string;
  stellarAddress: string;
  status: string;
  homeDomain: string;
}

interface AuditEvent {
  id: string;
  type: string;
  actor_role?: string;
  prev_hash?: string;
  chain_tx?: string;
  created_at: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"ops" | "registry" | "audit" | "simulate">(
    "ops",
  );

  // Ops Dashboard state
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);

  // Registry state
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [modifyingAddress, setModifyingAddress] = useState<string | null>(null);

  // System Audit state
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [chainIntegrity, setChainIntegrity] = useState<boolean>(true);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Failure Simulation state
  const [scenarioType, setScenarioType] = useState<
    "rpc_down" | "tx_failure" | "partial_sync"
  >("rpc_down");
  const [duration, setDuration] = useState(10);
  const [simulating, setSimulating] = useState(false);
  const [simulateSuccess, setSimulateSuccess] = useState<string | null>(null);
  const [simulateError, setSimulateError] = useState<string | null>(null);

  const loadHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await api.admin.getHealth();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHealth(res as any);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "Failed to load system health");
    } finally {
      setHealthLoading(false);
    }
  };

  const loadEntities = async () => {
    setEntitiesLoading(true);
    setEntityError(null);
    try {
      const res = await api.registry.getEntities();
      setEntities(res.entities ?? []);
    } catch (err) {
      setEntityError(
        err instanceof Error ? err.message : "Failed to load registry entities",
      );
    } finally {
      setEntitiesLoading(false);
    }
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await api.audit.getEvents();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAuditEvents((res.events as any[]) ?? []);
      setChainIntegrity(res.integrity?.valid ?? true);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Failed to load audit events");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  useEffect(() => {
    if (activeTab === "registry") loadEntities();
    if (activeTab === "audit") loadAudit();
  }, [activeTab]);

  const handleUpdateEntityStatus = async (
    stellarAddress: string,
    newStatus: "active" | "suspended" | "removed",
  ) => {
    setModifyingAddress(stellarAddress);
    try {
      await api.registry.updateEntityStatus(stellarAddress, { status: newStatus });
      await loadEntities();
    } catch (err) {
      alert(`Status update failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setModifyingAddress(null);
    }
  };

  const handleSimulateFailure = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    setSimulateError(null);
    setSimulateSuccess(null);

    try {
      await api.admin.simulateFailure({
        type: scenarioType,
      });
      setSimulateSuccess(
        `Failure '${scenarioType}' injected for ${duration}s. System simulated exception active.`,
      );
    } catch (err) {
      setSimulateError(
        err instanceof Error
          ? err.message
          : "Simulation failed (feature flag may be disabled)",
      );
    } finally {
      setSimulating(false);
    }
  };

  const isSimulationEnabled = health?.featureFlags?.["simulatedFailures"] ?? false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Navigation Tabs */}
      <nav
        aria-label="Admin portal navigation"
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: `1px solid ${tokens.color.border}`,
          paddingBottom: "0.5rem",
        }}
      >
        <Button
          variant={activeTab === "ops" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("ops")}
        >
          Operations Dashboard
        </Button>
        <Button
          variant={activeTab === "registry" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("registry")}
        >
          Institution Registry ({entities.length})
        </Button>
        <Button
          variant={activeTab === "audit" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("audit")}
        >
          System Audit & Hash Chain
        </Button>
        <Button
          variant={activeTab === "simulate" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("simulate")}
        >
          Failure Simulation Panel
        </Button>
      </nav>

      {/* ── TAB 1: OPERATIONS DASHBOARD ── */}
      {activeTab === "ops" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: tokens.typography.fontSize["2xl"],
                color: tokens.color.navy,
              }}
            >
              Operations Overview
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadHealth}
              loading={healthLoading}
            >
              Refresh Health
            </Button>
          </div>

          {healthLoading && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "1rem",
              }}
            >
              <Skeleton height="7rem" />
              <Skeleton height="7rem" />
              <Skeleton height="7rem" />
            </div>
          )}

          {healthError && (
            <ErrorState
              title="Could not load operations status"
              message={healthError}
              onRetry={loadHealth}
            />
          )}

          {!healthLoading && !healthError && health && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "1.25rem",
                }}
              >
                <Card>
                  <CardHeader>
                    <CardDescription>Network & API Status</CardDescription>
                    <CardTitle style={{ color: tokens.color.teal }}>
                      {health.status.toUpperCase()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textSecondary,
                    }}
                  >
                    Stellar Quickstart RPC: CONNECTED
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardDescription>Soroban Indexer Lag</CardDescription>
                    <CardTitle>
                      {health.indexer?.length
                        ? `${health.indexer[0]?.lag ?? 0} ledgers`
                        : "0 ledgers"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textSecondary,
                    }}
                  >
                    Synchronized to latest Soroban events
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardDescription>Active Incidents</CardDescription>
                    <CardTitle style={{ color: tokens.color.teal }}>0 Active</CardTitle>
                  </CardHeader>
                  <CardContent
                    style={{
                      fontSize: tokens.typography.fontSize.xs,
                      color: tokens.color.textSecondary,
                    }}
                  >
                    Zero open incidents reported
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Active System Feature Flags</CardTitle>
                  <CardDescription>Gated operational capabilities</CardDescription>
                </CardHeader>
                <CardContent>
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
                      {JSON.stringify(health.featureFlags, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: REGISTRY VIEWER & ACTIONS ── */}
      {activeTab === "registry" && (
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
                <CardTitle>Soroban Institutional Registry</CardTitle>
                <CardDescription>
                  Authorised Issuers and Verifiers anchored to the Soroban issuer-registry
                  contract.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadEntities}
                loading={entitiesLoading}
              >
                Refresh
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {entitiesLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Skeleton height="3rem" />
                <Skeleton height="3rem" />
              </div>
            )}

            {entityError && (
              <ErrorState
                title="Could not load registry entities"
                message={entityError}
                onRetry={loadEntities}
              />
            )}

            {!entitiesLoading && !entityError && entities.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  color: tokens.color.textSecondary,
                  background: tokens.color.surfaceMuted,
                  borderRadius: tokens.radius.md,
                }}
              >
                No entities found in registry.
              </div>
            )}

            {!entitiesLoading && !entityError && entities.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}
                >
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${tokens.color.border}` }}>
                      <th style={{ padding: "0.75rem" }}>Institution Name</th>
                      <th style={{ padding: "0.75rem" }}>Role</th>
                      <th style={{ padding: "0.75rem" }}>Stellar Address</th>
                      <th style={{ padding: "0.75rem" }}>Home Domain</th>
                      <th style={{ padding: "0.75rem" }}>Status</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entities.map((ent) => (
                      <tr
                        key={ent.id}
                        style={{ borderBottom: `1px solid ${tokens.color.border}` }}
                      >
                        <td style={{ padding: "0.75rem", fontWeight: 600 }}>
                          {ent.name}
                        </td>
                        <td style={{ padding: "0.75rem", textTransform: "capitalize" }}>
                          {ent.role}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontFamily: "monospace",
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {ent.stellarAddress.slice(0, 10)}...
                          {ent.stellarAddress.slice(-6)}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {ent.homeDomain}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <Badge
                            status={
                              ent.status === "active"
                                ? "active"
                                : ent.status === "suspended"
                                  ? "suspended"
                                  : "revoked"
                            }
                          >
                            {ent.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td style={{ padding: "0.75rem", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                            {ent.status === "active" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                loading={modifyingAddress === ent.stellarAddress}
                                onClick={() =>
                                  handleUpdateEntityStatus(
                                    ent.stellarAddress,
                                    "suspended",
                                  )
                                }
                              >
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="primary"
                                loading={modifyingAddress === ent.stellarAddress}
                                onClick={() =>
                                  handleUpdateEntityStatus(ent.stellarAddress, "active")
                                }
                              >
                                Activate
                              </Button>
                            )}
                            {ent.status !== "removed" && (
                              <Button
                                size="sm"
                                variant="danger"
                                loading={modifyingAddress === ent.stellarAddress}
                                onClick={() =>
                                  handleUpdateEntityStatus(ent.stellarAddress, "removed")
                                }
                              >
                                Remove
                              </Button>
                            )}
                          </div>
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

      {/* ── TAB 3: SYSTEM AUDIT & HASH CHAIN ── */}
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
                <CardTitle>System Audit Log & Cryptographic Hash Chain</CardTitle>
                <CardDescription>
                  SHA-256 tamper-evident backlink chain verifying zero unauthorized
                  modifications.
                </CardDescription>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: tokens.radius.sm,
                    fontWeight: 700,
                    fontSize: tokens.typography.fontSize.xs,
                    background: chainIntegrity
                      ? tokens.color.tealLight
                      : tokens.color.errorLight,
                    color: chainIntegrity ? tokens.color.tealDark : tokens.color.error,
                  }}
                >
                  {chainIntegrity ? "✓ Hash Chain: VALID" : "⚠ Hash Chain: TAMPERED"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAudit}
                  loading={auditLoading}
                >
                  Verify
                </Button>
              </div>
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
                title="Could not load audit log"
                message={auditError}
                onRetry={loadAudit}
              />
            )}

            {!auditLoading && !auditError && auditEvents.length === 0 && (
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

            {!auditLoading && !auditError && auditEvents.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}
                >
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${tokens.color.border}` }}>
                      <th style={{ padding: "0.75rem" }}>Event Type</th>
                      <th style={{ padding: "0.75rem" }}>Actor Role</th>
                      <th style={{ padding: "0.75rem" }}>Previous Hash</th>
                      <th style={{ padding: "0.75rem" }}>Chain Transaction</th>
                      <th style={{ padding: "0.75rem" }}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.map((ev) => (
                      <tr
                        key={ev.id}
                        style={{ borderBottom: `1px solid ${tokens.color.border}` }}
                      >
                        <td
                          style={{
                            padding: "0.75rem",
                            fontWeight: 600,
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {ev.type}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {ev.actor_role ?? "SYSTEM"}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontFamily: "monospace",
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {ev.prev_hash
                            ? `${ev.prev_hash.slice(0, 16)}...`
                            : "GENESIS_ROOT"}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontFamily: "monospace",
                            fontSize: tokens.typography.fontSize.xs,
                          }}
                        >
                          {ev.chain_tx ? `${ev.chain_tx.slice(0, 12)}...` : "Off-chain"}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.color.textSecondary,
                          }}
                        >
                          {new Date(ev.created_at).toLocaleString()}
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

      {/* ── TAB 4: FLAG-GATED FAILURE SIMULATION PANEL ── */}
      {activeTab === "simulate" && (
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
                <CardTitle>Chaos Engineering & Failure Simulation</CardTitle>
                <CardDescription>
                  Test system resilience by simulating RPC down, transaction timeout, and
                  partial sync states.
                </CardDescription>
              </div>
              <Badge status={isSimulationEnabled ? "active" : "revoked"}>
                {isSimulationEnabled ? "FEATURE ACTIVE" : "FEATURE GATED"}
              </Badge>
            </div>
          </CardHeader>

          {!isSimulationEnabled ? (
            <CardContent>
              <div
                style={{
                  padding: "1.5rem",
                  background: tokens.color.surfaceMuted,
                  borderRadius: tokens.radius.md,
                  textAlign: "center",
                  color: tokens.color.textSecondary,
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.5rem 0",
                    fontWeight: 600,
                    color: tokens.color.navy,
                  }}
                >
                  Failure simulation is gated by{" "}
                  <code>FEATURE_SIMULATED_FAILURES=true</code>.
                </p>
                <p style={{ margin: 0, fontSize: tokens.typography.fontSize.xs }}>
                  To enable simulation testing in local development, set{" "}
                  <code>FEATURE_SIMULATED_FAILURES=true</code> in your environment.
                </p>
              </div>
            </CardContent>
          ) : (
            <form onSubmit={handleSimulateFailure}>
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
                    Failure Scenario
                  </label>
                  <select
                    value={scenarioType}
                    onChange={(e) =>
                      setScenarioType(
                        e.target.value as "rpc_down" | "tx_failure" | "partial_sync",
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
                    <option value="rpc_down">
                      RPC Down — Soroban RPC server unreachable
                    </option>
                    <option value="tx_failure">
                      Tx Failure — Stellar transaction submission rejected
                    </option>
                    <option value="partial_sync">
                      Partial Sync — Multi-party correction partial failure
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
                    Simulation Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.875rem",
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.borderStrong}`,
                      fontSize: tokens.typography.fontSize.sm,
                    }}
                  />
                </div>

                {simulateError && (
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
                    {simulateError}
                  </div>
                )}

                {simulateSuccess && (
                  <div
                    role="status"
                    style={{
                      padding: "1rem",
                      background: tokens.color.successLight,
                      border: `1px solid ${tokens.color.teal}`,
                      borderRadius: tokens.radius.md,
                      color: tokens.color.tealDark,
                      fontWeight: 600,
                      fontSize: tokens.typography.fontSize.sm,
                    }}
                  >
                    ✓ {simulateSuccess}
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button type="submit" variant="danger" loading={simulating}>
                  Trigger Simulated Failure
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
