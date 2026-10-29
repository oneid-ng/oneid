"use client";

import React from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalLayout } from "@/components/PortalLayout";

export default function TelecomLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard
      allowedRoles={["verifier", "telecom", "admin"]}
      portalName="Telecom Portal"
    >
      <PortalLayout portalTitle="GloTel Mobile Telecom Portal" portalRole="Telecom">
        {children}
      </PortalLayout>
    </RoleGuard>
  );
}
