"use client";

import React from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalLayout } from "@/components/PortalLayout";

export default function VerifierLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["verifier", "admin"]} portalName="Verifier Portal">
      <PortalLayout portalTitle="Verifier Portal" portalRole="Verifier">
        {children}
      </PortalLayout>
    </RoleGuard>
  );
}
