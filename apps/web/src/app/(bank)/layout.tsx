"use client";

import React from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalLayout } from "@/components/PortalLayout";

export default function BankLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["verifier", "bank", "admin"]} portalName="Bank Portal">
      <PortalLayout portalTitle="Apex Trust Bank Portal" portalRole="Bank">
        {children}
      </PortalLayout>
    </RoleGuard>
  );
}
