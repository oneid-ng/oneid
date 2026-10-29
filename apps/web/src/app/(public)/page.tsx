"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

export default function WelcomePage() {
  const router = useRouter();
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePortalLogin = async (
    role: "citizen" | "issuer" | "verifier" | "admin" | "bank" | "telecom",
  ) => {
    setLoggingIn(role);
    setError(null);
    try {
      if (role === "bank" || role === "telecom") {
        await api.auth.loginPortal({
          role: "verifier",
          demoKey: "demo-verifier-2026",
        });
        router.push(`/${role}`);
      } else {
        await api.auth.loginPortal({
          role,
          demoKey: `demo-${role}-2026`,
        });
        if (role === "citizen") {
          router.push("/home");
        } else {
          router.push(`/${role}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setLoggingIn(null);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: tokens.color.offWhite,
      }}
    >
      {/* Testnet & Synthetic Data Banner (README §4, §21) */}
      <div
        role="region"
        aria-label="Demo notice"
        style={{
          width: "100%",
          maxWidth: "42rem",
          background: tokens.color.surfaceMuted,
          border: `1px solid ${tokens.color.borderStrong}`,
          borderRadius: tokens.radius.md,
          padding: "0.75rem 1rem",
          marginBottom: "1.5rem",
          fontSize: tokens.typography.fontSize.xs,
          color: tokens.color.textSecondary,
          textAlign: "center",
          lineHeight: tokens.typography.lineHeight.normal,
        }}
      >
        <strong style={{ color: tokens.color.navy }}>DEMO ENVIRONMENT:</strong> Reusable,
        consent-based KYC for Nigeria on the Stellar network. Synthetic data only — no
        real NIN, BVN or biometrics. Stellar local network / testnet only. No claim of
        compliance, certification or official affiliation.
      </div>

      <Card style={{ width: "100%", maxWidth: "36rem", padding: "2rem" }}>
        <CardHeader style={{ textAlign: "center", alignItems: "center" }}>
          <div
            style={{
              width: "3.5rem",
              height: "3.5rem",
              borderRadius: tokens.radius.full,
              background: tokens.color.navy,
              color: tokens.color.gold,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.75rem",
              fontWeight: 800,
              letterSpacing: "-0.05em",
              marginBottom: "0.5rem",
            }}
          >
            1
          </div>
          <CardTitle style={{ fontSize: tokens.typography.fontSize["3xl"] }}>
            ONEiD
          </CardTitle>
          <CardDescription
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.color.teal,
              fontWeight: 500,
            }}
          >
            One identity. More possibilities.
          </CardDescription>
        </CardHeader>

        <CardContent style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <p
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.color.textSecondary,
              textAlign: "center",
              lineHeight: tokens.typography.lineHeight.normal,
              margin: 0,
            }}
          >
            Verify your identity once with an authorised issuer, hold your W3C SD-JWT
            credential in your passkey wallet, and share only approved attributes with
            explicit, purpose-bound consent.
          </p>

          {error && (
            <div
              role="alert"
              style={{
                padding: "0.75rem",
                borderRadius: tokens.radius.md,
                background: tokens.color.errorLight,
                color: tokens.color.error,
                fontSize: tokens.typography.fontSize.sm,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Link href="/onboard" style={{ textDecoration: "none", width: "100%" }}>
              <Button variant="secondary" size="lg" style={{ width: "100%" }}>
                Onboard as Citizen (Get Started)
              </Button>
            </Link>

            <Button
              variant="primary"
              size="lg"
              loading={loggingIn === "citizen"}
              onClick={() => handlePortalLogin("citizen")}
              style={{ width: "100%" }}
            >
              Enter Citizen Portal (Demo Account)
            </Button>
          </div>

          <div
            style={{
              marginTop: "0.5rem",
              paddingTop: "1.25rem",
              borderTop: `1px solid ${tokens.color.border}`,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.color.textMuted,
                fontWeight: tokens.typography.fontWeight.semibold,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                textAlign: "center",
              }}
            >
              Institutional Portals (Demo Roles)
            </span>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
                gap: "0.5rem",
              }}
            >
              <Button
                variant="outline"
                size="sm"
                loading={loggingIn === "issuer"}
                onClick={() => handlePortalLogin("issuer")}
              >
                Issuer
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={loggingIn === "verifier"}
                onClick={() => handlePortalLogin("verifier")}
              >
                Verifier
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={loggingIn === "bank"}
                onClick={() => handlePortalLogin("bank")}
              >
                Bank
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={loggingIn === "telecom"}
                onClick={() => handlePortalLogin("telecom")}
              >
                Telecom
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={loggingIn === "admin"}
                onClick={() => handlePortalLogin("admin")}
              >
                Admin
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
