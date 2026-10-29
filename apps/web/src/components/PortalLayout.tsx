"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, tokens } from "@oneid/ui";
import { api } from "@/lib/api";

export interface PortalLayoutProps {
  portalTitle: string;
  portalRole: string;
  children: React.ReactNode;
}

export function PortalLayout({ portalTitle, portalRole, children }: PortalLayoutProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } finally {
      router.push("/");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: tokens.color.offWhite,
      }}
    >
      {/* Testnet & Synthetic Data Banner (README §4, §21) */}
      <div
        role="region"
        aria-label="Demo environment notification"
        style={{
          background: tokens.color.navyDark,
          color: tokens.color.goldLight,
          fontSize: tokens.typography.fontSize.xs,
          padding: "0.375rem 1rem",
          textAlign: "center",
          fontWeight: 500,
        }}
      >
        ONEiD Stellar Testnet Demo · Synthetic Data Only · No Real Personal Data On-Chain
      </div>

      {/* Portal Header */}
      <header
        style={{
          background: tokens.color.surface,
          borderBottom: `1px solid ${tokens.color.border}`,
          padding: "0 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "4rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: "50%",
                background: tokens.color.navy,
                color: tokens.color.gold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "1rem",
              }}
            >
              1
            </span>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: 700,
                color: tokens.color.navy,
              }}
            >
              ONEiD
            </span>
          </Link>

          <span
            style={{
              color: tokens.color.borderStrong,
              fontSize: tokens.typography.fontSize.lg,
            }}
          >
            /
          </span>

          <span
            style={{
              fontWeight: 600,
              fontSize: tokens.typography.fontSize.base,
              color: tokens.color.navyDark,
            }}
          >
            {portalTitle}
          </span>

          <span
            style={{
              background: tokens.color.tealLight,
              color: tokens.color.teal,
              fontSize: tokens.typography.fontSize.xs,
              padding: "0.2rem 0.5rem",
              borderRadius: tokens.radius.sm,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {portalRole}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <Button variant="ghost" size="sm">
              All Portals
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Page Area */}
      <main
        style={{
          flex: 1,
          padding: "2rem 1.5rem",
          maxWidth: "76rem",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}
