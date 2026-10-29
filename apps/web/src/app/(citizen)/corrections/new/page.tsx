"use client";

import React, { useState } from "react";
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
  Input,
  ErrorState,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

const TARGET_INSTITUTIONS = [
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "First Demo Bank",
    domain: "bank.demo.oneid.local",
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    name: "Demo Telecom Nigeria",
    domain: "telecom.demo.oneid.local",
  },
];

export default function NewCorrectionPage() {
  const router = useRouter();
  const [category, setCategory] = useState("address");
  const [newDetail, setNewDetail] = useState("Abuja, Nigeria (fictional)");
  const [selectedInstitutions, setSelectedInstitutions] = useState<string[]>([
    TARGET_INSTITUTIONS[0]!.id,
    TARGET_INSTITUTIONS[1]!.id,
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleInstitution = (id: string) => {
    setSelectedInstitutions((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedInstitutions.length === 0) {
      setError("Please select at least one target institution.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.corrections.create({
        category,
        detail: {
          newValue: newDetail,
          reason: "Citizen requested update",
        },
        targetInstitutions: selectedInstitutions,
      });

      router.push(`/corrections/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open correction ticket");
      setSubmitting(false);
    }
  };

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
          Request an Identity Update
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.color.textSecondary,
          }}
        >
          Open a correction ticket across multiple institutions. Authority stays with each
          institution.
        </p>
      </div>

      {error && (
        <ErrorState
          title="Submission error"
          message={error}
          onRetry={() => setError(null)}
          retryLabel="Dismiss"
        />
      )}

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Correction Ticket Details</CardTitle>
            <CardDescription>
              Off-chain update request with cryptographic tracking on Soroban{" "}
              <code>correction-tracker</code>.
            </CardDescription>
          </CardHeader>

          <CardContent
            style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
          >
            <div>
              <label
                htmlFor="category-select"
                style={{
                  display: "block",
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                  color: tokens.color.textPrimary,
                }}
              >
                Category
              </label>
              <select
                id="category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: tokens.radius.md,
                  border: `1.5px solid ${tokens.color.borderStrong}`,
                  fontFamily: tokens.typography.fontFamily,
                  fontSize: tokens.typography.fontSize.base,
                  background: tokens.color.surface,
                }}
              >
                <option value="address">Residential Address</option>
                <option value="phone">Phone Number (MSISDN)</option>
                <option value="email">Email Address</option>
              </select>
            </div>

            <Input
              label="New Synthetic Value"
              value={newDetail}
              onChange={(e) => setNewDetail(e.target.value)}
              required
              disabled={submitting}
              hint="Fictional synthetic data only. Never submit real personal data."
            />

            <div>
              <span
                style={{
                  display: "block",
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                }}
              >
                Target Institutions (Each Responds Independently):
              </span>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
                role="group"
                aria-label="Target institutions"
              >
                {TARGET_INSTITUTIONS.map((inst) => {
                  const isChecked = selectedInstitutions.includes(inst.id);
                  return (
                    <label
                      key={inst.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.75rem",
                        borderRadius: tokens.radius.md,
                        border: `1.5px solid ${isChecked ? tokens.color.teal : tokens.color.border}`,
                        background: isChecked
                          ? "rgba(11, 123, 138, 0.04)"
                          : tokens.color.surface,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleInstitution(inst.id)}
                        disabled={submitting}
                        style={{
                          width: "1.125rem",
                          height: "1.125rem",
                          accentColor: tokens.color.teal,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.sm,
                            fontWeight: 600,
                            color: tokens.color.navy,
                          }}
                        >
                          {inst.name}
                        </div>
                        <div
                          style={{
                            fontSize: tokens.typography.fontSize.xs,
                            color: tokens.color.textMuted,
                          }}
                        >
                          {inst.domain}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
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
              <strong>Rule #1 & #6:</strong> Correction details and evidence stay strictly
              off-chain. Only the salted ticket hash and institution outcome statuses live
              on-chain. Each institution updates only its own status.
            </div>
          </CardContent>

          <CardFooter
            style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}
          >
            <Link href="/home" style={{ textDecoration: "none" }}>
              <Button variant="ghost" disabled={submitting}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" loading={submitting}>
              Open Correction Ticket
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
