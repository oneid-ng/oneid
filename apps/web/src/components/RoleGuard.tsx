"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Skeleton,
  tokens,
} from "@oneid/ui";
import { api } from "@/lib/api";

export interface RoleGuardProps {
  allowedRoles: string[];
  portalName: string;
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, portalName, children }: RoleGuardProps) {
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const checkRole = async () => {
    setLoading(true);
    try {
      const me = await api.auth
        .getMe()
        .catch(() => ({ authenticated: false, user: undefined }));
      if (me.authenticated && me.user?.role) {
        setCurrentRole(me.user.role);
      } else {
        setCurrentRole(null);
      }
    } catch {
      setCurrentRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkRole();
  }, []);

  const handleQuickLoginAs = async (roleToLogin: string) => {
    setSwitching(true);
    try {
      await api.auth.loginPortal({
        role: roleToLogin,
        demoKey: `demo-${roleToLogin}-2026`,
      });
      await checkRole();
    } catch {
      // ignore
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: "36rem", margin: "3rem auto", padding: "1.5rem" }}>
        <Skeleton height="3rem" />
        <div style={{ marginTop: "1rem" }}>
          <Skeleton height="10rem" />
        </div>
      </div>
    );
  }

  // Fail closed if not authenticated or role not allowed (README §19, rule #5)
  const isAllowed = currentRole && allowedRoles.includes(currentRole);

  if (!isAllowed) {
    return (
      <div style={{ maxWidth: "36rem", margin: "3rem auto", padding: "1rem" }}>
        <Card variant="bordered" style={{ border: `2px solid ${tokens.color.error}` }}>
          <CardHeader>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  background: tokens.color.error,
                  color: tokens.color.textInverse,
                  padding: "0.25rem 0.5rem",
                  borderRadius: tokens.radius.sm,
                  fontSize: tokens.typography.fontSize.xs,
                  fontWeight: 700,
                  fontFamily: "monospace",
                }}
              >
                FORBIDDEN_ROLE (403)
              </span>
            </div>
            <CardTitle
              style={{
                color: tokens.color.error,
                fontSize: tokens.typography.fontSize.xl,
              }}
            >
              Access Denied — Wrong Role
            </CardTitle>
            <CardDescription>
              This portal requires an authorised role. Access fails closed by default.
            </CardDescription>
          </CardHeader>

          <CardContent
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <div
              style={{
                background: tokens.color.errorLight,
                padding: "0.75rem 1rem",
                borderRadius: tokens.radius.md,
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.color.navyDark,
              }}
            >
              <div>
                <strong>Target Portal:</strong> {portalName}
              </div>
              <div>
                <strong>Required Role:</strong> <code>{allowedRoles.join(" | ")}</code>
              </div>
              <div>
                <strong>Active Role:</strong>{" "}
                <code>{currentRole ? currentRole : "Unauthenticated (None)"}</code>
              </div>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: tokens.typography.fontSize.xs,
                color: tokens.color.textSecondary,
              }}
            >
              Demo convenience: Click below to switch your demo session to an authorised
              role for this portal.
            </p>
          </CardContent>

          <CardFooter
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <Link href="/" style={{ textDecoration: "none" }}>
              <Button variant="ghost">Return Home</Button>
            </Link>

            {allowedRoles[0] && (
              <Button
                variant="primary"
                loading={switching}
                onClick={() => handleQuickLoginAs(allowedRoles[0]!)}
              >
                Sign In as {allowedRoles[0]!.toUpperCase()} (Demo)
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
