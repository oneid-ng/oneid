"use client";

import React from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalLayout } from "@/components/PortalLayout";

export default function IssuerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["issuer", "admin"]} portalName="Issuer Portal">
      <PortalLayout portalTitle="Identity Issuer Portal" portalRole="Issuer">
        {children}
      </PortalLayout>
    </RoleGuard>
  );
}
