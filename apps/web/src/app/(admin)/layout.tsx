"use client";

import React from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalLayout } from "@/components/PortalLayout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["admin"]} portalName="Administration & Operations Portal">
      <PortalLayout portalTitle="System Administration & Operations" portalRole="Admin">
        {children}
      </PortalLayout>
    </RoleGuard>
  );
}
