"use client";

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  tokens,
} from "@oneid/ui";

export default function DigitalIdPage() {
  const [showSensitive, setShowSensitive] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.75rem",
        maxWidth: "40rem",
        margin: "0 auto",
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
          Digital ID Card
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.color.textSecondary,
          }}
        >
          Cryptographically signed W3C SD-JWT credential held in your passkey wallet.
        </p>
      </div>

      {/* Visual Identity Card */}
      <div
        style={{
          background: `linear-gradient(135deg, ${tokens.color.navy} 0%, ${tokens.color.navyLight} 100%)`,
          borderRadius: tokens.radius.xl,
          padding: "1.75rem",
          color: tokens.color.textInverse,
          boxShadow: tokens.shadow.lg,
          border: `2px solid ${tokens.color.gold}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background watermark */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "-2rem",
            bottom: "-2rem",
            fontSize: "12rem",
            fontWeight: 900,
            color: "rgba(255,255,255,0.03)",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          1
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.color.goldLight,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              FEDERAL REPUBLIC OF NIGERIA · DEMO
            </span>
            <h3
              style={{
                margin: "0.25rem 0 0 0",
                fontSize: tokens.typography.fontSize.xl,
                fontWeight: 700,
              }}
            >
              ONEiD National Digital Identity
            </h3>
          </div>
          <Badge status="active">Active On-Chain</Badge>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
              }}
            >
              Full Legal Name
            </span>
            <div style={{ fontSize: tokens.typography.fontSize.base, fontWeight: 600 }}>
              Adaeze Okonkwo
            </div>
          </div>

          <div>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
              }}
            >
              Synthetic NIN
            </span>
            <div style={{ fontSize: tokens.typography.fontSize.base, fontWeight: 600 }}>
              {showSensitive ? "1234 5678 9012" : "•••• •••• 9012"}
            </div>
          </div>

          <div>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
              }}
            >
              Date of Birth
            </span>
            <div style={{ fontSize: tokens.typography.fontSize.base, fontWeight: 600 }}>
              {showSensitive ? "1990-03-12 (Over 18)" : "••••-••-•• (Over 18)"}
            </div>
          </div>

          <div>
            <span
              style={{
                fontSize: tokens.typography.fontSize.xs,
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
              }}
            >
              KYC Level
            </span>
            <div
              style={{
                fontSize: tokens.typography.fontSize.base,
                fontWeight: 600,
                color: tokens.color.goldLight,
              }}
            >
              Tier 2 Verified
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "1px solid rgba(255,255,255,0.15)",
            paddingTop: "1rem",
          }}
        >
          <div>
            <span style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.6)" }}>
              Holder Binding: did:stellar:demo:00000000-0000...
            </span>
            <div style={{ fontSize: "0.6875rem", color: tokens.color.goldLight }}>
              Stellar Soroban Status Monitored
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSensitive(!showSensitive)}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: tokens.radius.sm,
              color: tokens.color.textInverse,
              fontSize: tokens.typography.fontSize.xs,
              padding: "0.25rem 0.5rem",
              cursor: "pointer",
            }}
          >
            {showSensitive ? "Mask Details" : "Reveal Details"}
          </button>
        </div>
      </div>

      {/* QR Code Presentation Simulator */}
      <Card>
        <CardHeader>
          <CardTitle>In-Person QR Code Presentation</CardTitle>
          <CardDescription>
            Show this dynamic QR code to an authorised verifier to initiate a selective
            disclosure request.
          </CardDescription>
        </CardHeader>
        <CardContent
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {/* Simulated QR Code SVG */}
          <div
            style={{
              padding: "1rem",
              background: "#FFFFFF",
              border: `2px solid ${tokens.color.navy}`,
              borderRadius: tokens.radius.lg,
            }}
            aria-label="QR code for identity presentation"
          >
            <svg
              width="160"
              height="160"
              viewBox="0 0 160 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="160" height="160" fill="white" />
              {/* Corner markers */}
              <rect x="10" y="10" width="40" height="40" fill="#0D1F3C" />
              <rect x="20" y="20" width="20" height="20" fill="white" />
              <rect x="110" y="10" width="40" height="40" fill="#0D1F3C" />
              <rect x="120" y="20" width="20" height="20" fill="white" />
              <rect x="10" y="110" width="40" height="40" fill="#0D1F3C" />
              <rect x="20" y="120" width="20" height="20" fill="white" />
              {/* Data dots */}
              <rect x="60" y="20" width="10" height="10" fill="#0B7B8A" />
              <rect x="80" y="20" width="10" height="10" fill="#0D1F3C" />
              <rect x="70" y="40" width="20" height="10" fill="#C9972A" />
              <rect x="60" y="60" width="40" height="40" fill="#0D1F3C" />
              <rect x="70" y="70" width="20" height="20" fill="white" />
              <rect x="20" y="60" width="20" height="10" fill="#0B7B8A" />
              <rect x="110" y="60" width="10" height="30" fill="#0D1F3C" />
              <rect x="130" y="70" width="20" height="10" fill="#C9972A" />
              <rect x="60" y="110" width="20" height="20" fill="#0B7B8A" />
              <rect x="90" y="120" width="30" height="10" fill="#0D1F3C" />
              <rect x="130" y="120" width="10" height="20" fill="#0B7B8A" />
            </svg>
          </div>

          <span
            style={{
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.color.textMuted,
            }}
          >
            Ephemeral Nonce: <code>d9a4...72b1</code> · Valid for 5 minutes
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
