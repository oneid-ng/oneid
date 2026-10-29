"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { tokens } from "@oneid/ui";
import { api } from "@/lib/api";

const NAV_LINKS = [
  { href: "/home", label: "Home" },
  { href: "/digital-id", label: "Digital ID" },
  { href: "/credentials", label: "Credentials" },
  { href: "/requests", label: "My Requests" },
  { href: "/corrections/new", label: "Update Record" },
  { href: "/audit", label: "Audit Timeline" },
];

export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
      {/* Top Banner */}
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

      {/* Main Navigation Header */}
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
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link
            href="/home"
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
              padding: "0.125rem 0.5rem",
              borderRadius: tokens.radius.full,
              background: tokens.color.surfaceMuted,
              color: tokens.color.tealDark,
              fontSize: tokens.typography.fontSize.xs,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Citizen
          </span>
        </div>

        <nav
          aria-label="Citizen portal navigation"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/home" && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: tokens.radius.md,
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? tokens.color.teal : tokens.color.textSecondary,
                  background: isActive ? tokens.color.surfaceMuted : "transparent",
                  textDecoration: "none",
                }}
              >
                {link.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            style={{
              marginLeft: "0.5rem",
              padding: "0.375rem 0.75rem",
              borderRadius: tokens.radius.md,
              border: `1px solid ${tokens.color.border}`,
              background: "transparent",
              color: tokens.color.textSecondary,
              fontSize: tokens.typography.fontSize.xs,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          padding: "2rem 1.5rem",
          maxWidth: "64rem",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
