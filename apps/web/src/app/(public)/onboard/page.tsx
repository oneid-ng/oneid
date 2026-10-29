"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Stepper,
  ErrorState,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

const STEPS = [
  { title: "Verify NIN", description: "Synthetic identity" },
  { title: "Face Check", description: "Simulated liveness" },
  { title: "Create Wallet", description: "Passkey setup" },
  { title: "Complete", description: "Review & finish" },
];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Form state
  const [nin, setNin] = useState("1234 5678 9012");
  const [syntheticProfile, setSyntheticProfile] = useState<{
    fullName?: string;
    kycTier?: number;
    address?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  // Step 1: Verify synthetic NIN
  const handleVerifyNin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.identity.verifyMockNin({ nin });
      if (res.valid) {
        setSyntheticProfile(
          res.profile as { fullName?: string; kycTier?: number; address?: string },
        );
        setStep(1);
      } else {
        setError({
          message: "Invalid synthetic NIN. Use: 1234 5678 9012 or 9876 5432 1098.",
        });
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Failed to verify NIN" });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Simulated face check
  const handleFaceCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.identity.simulateFaceCheck({ imageRef: "synthetic-face-01" });
      if (res.matched) {
        setStep(2);
      } else {
        setError({ message: "Simulated face check did not match. Please retry." });
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Face check failed" });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Passkey wallet creation (Zero XLM holder, fee sponsored)
  const handleCreateWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      // Login portal as citizen to initialise demo session & zero-XLM wallet
      await api.auth.loginPortal({
        role: "citizen",
        demoKey: "demo-citizen-2026",
      });
      setStep(3);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Failed to create passkey wallet",
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Finish and go to Home
  const handleFinish = () => {
    router.push("/home");
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
      <div style={{ width: "100%", maxWidth: "34rem", marginBottom: "1.5rem" }}>
        <Stepper steps={STEPS} currentStep={step} />
      </div>

      <Card style={{ width: "100%", maxWidth: "34rem", padding: "1.75rem" }}>
        {error && (
          <div style={{ marginBottom: "1rem" }}>
            <ErrorState
              message={error.message}
              code={error.code}
              onRetry={() => setError(null)}
              retryLabel="Dismiss"
            />
          </div>
        )}

        {/* Step 0: NIN Verification */}
        {step === 0 && (
          <form onSubmit={handleVerifyNin}>
            <CardHeader>
              <CardTitle>1. Verify Your Identity</CardTitle>
              <CardDescription>
                Enter your synthetic NIN to retrieve pre-verified KYC attributes.
              </CardDescription>
            </CardHeader>
            <CardContent
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div
                style={{
                  background: tokens.color.surfaceMuted,
                  padding: "0.75rem",
                  borderRadius: tokens.radius.md,
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.color.textSecondary,
                }}
              >
                <strong>Synthetic test NINs:</strong> <code>1234 5678 9012</code> or{" "}
                <code>9876 5432 1098</code>. Real personal data is never accepted.
              </div>

              <Input
                label="Synthetic National Identity Number (NIN)"
                hint="Format: DDDD DDDD DDDD"
                value={nin}
                onChange={(e) => setNin(e.target.value)}
                required
                disabled={loading}
              />
            </CardContent>
            <CardFooter>
              <Link href="/" style={{ textDecoration: "none" }}>
                <Button variant="ghost">Cancel</Button>
              </Link>
              <Button type="submit" variant="primary" loading={loading}>
                Verify NIN
              </Button>
            </CardFooter>
          </form>
        )}

        {/* Step 1: Simulated Face Check */}
        {step === 1 && (
          <div>
            <CardHeader>
              <CardTitle>2. Liveness & Face Verification</CardTitle>
              <CardDescription>
                Simulated biometric check confirming identity binding without storing
                facial data on-chain.
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
              <div
                style={{
                  width: "8rem",
                  height: "8rem",
                  borderRadius: tokens.radius.full,
                  border: `3px dashed ${tokens.color.teal}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2.5rem",
                  background: tokens.color.surfaceMuted,
                }}
                aria-hidden="true"
              >
                👤
              </div>

              <p
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.color.textSecondary,
                  textAlign: "center",
                  margin: 0,
                }}
              >
                Matched profile:{" "}
                <strong>{syntheticProfile?.fullName || "Adaeze Okonkwo"}</strong>
              </p>
              <p
                style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.color.textMuted,
                  textAlign: "center",
                  margin: 0,
                }}
              >
                Simulating camera check against synthetic issuer registry records.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" onClick={() => setStep(0)} disabled={loading}>
                Back
              </Button>
              <Button variant="secondary" onClick={handleFaceCheck} loading={loading}>
                Simulate Face Check
              </Button>
            </CardFooter>
          </div>
        )}

        {/* Step 2: Passkey Wallet Creation */}
        {step === 2 && (
          <div>
            <CardHeader>
              <CardTitle>3. Create Passkey Wallet</CardTitle>
              <CardDescription>
                Secure your ONEiD with a cryptographic passkey. Complete all transactions
                holding 0 XLM via Stellar fee sponsorship.
              </CardDescription>
            </CardHeader>
            <CardContent
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div
                style={{
                  padding: "0.875rem",
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.color.tealLight}`,
                  background: tokens.color.surfaceMuted,
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.color.navy,
                }}
              >
                <strong>✓ Zero-XLM Gasless Operations:</strong> Your citizen wallet holds
                0 XLM. All transaction fees for consent receipts and corrections are
                sponsored by the ONEiD platform.
              </div>

              <p
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.color.textSecondary,
                  margin: 0,
                }}
              >
                A passkey credential will be generated and stored securely on your local
                device.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" onClick={() => setStep(1)} disabled={loading}>
                Back
              </Button>
              <Button variant="primary" onClick={handleCreateWallet} loading={loading}>
                Generate Passkey Wallet
              </Button>
            </CardFooter>
          </div>
        )}

        {/* Step 3: Complete & Review */}
        {step === 3 && (
          <div>
            <CardHeader>
              <CardTitle>4. Welcome to ONEiD!</CardTitle>
              <CardDescription>
                Your digital identity is set up and ready to use.
              </CardDescription>
            </CardHeader>
            <CardContent
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div
                style={{
                  padding: "1rem",
                  borderRadius: tokens.radius.md,
                  background: tokens.color.successLight,
                  color: tokens.color.success,
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                }}
              >
                ✓ Passkey wallet successfully created! Your verifiable credential is
                encrypted and stored locally.
              </div>

              <div
                style={{
                  fontSize: tokens.typography.fontSize.sm,
                  color: tokens.color.textSecondary,
                }}
              >
                <div>
                  <strong>Name:</strong> {syntheticProfile?.fullName || "Adaeze Okonkwo"}
                </div>
                <div>
                  <strong>KYC Status:</strong> Tier 2 Verified
                </div>
                <div>
                  <strong>Wallet Balance:</strong> 0.00 XLM (Sponsored)
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleFinish}
                style={{ width: "100%" }}
              >
                Enter My Citizen Dashboard
              </Button>
            </CardFooter>
          </div>
        )}
      </Card>
    </main>
  );
}
