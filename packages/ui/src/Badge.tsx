import React from "react";
import { tokens } from "./tokens.js";

export type OnChainStatus =
  | "active"
  | "revoked"
  | "expired"
  | "suspended"
  | "partially_applied"
  | "submitted"
  | "applied"
  | "rejected"
  | "failed";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: OnChainStatus;
  children?: React.ReactNode;
}

export const Badge = ({ status = "active", children, style, ...props }: BadgeProps) => {
  const statusConfig: Record<
    OnChainStatus,
    { label: string; bg: string; text: string; dot: string }
  > = {
    active: {
      label: "Active (On-Chain)",
      bg: tokens.color.successLight,
      text: tokens.color.success,
      dot: tokens.color.success,
    },
    applied: {
      label: "Applied (On-Chain)",
      bg: tokens.color.successLight,
      text: tokens.color.success,
      dot: tokens.color.success,
    },
    revoked: {
      label: "Revoked (On-Chain)",
      bg: tokens.color.errorLight,
      text: tokens.color.error,
      dot: tokens.color.error,
    },
    rejected: {
      label: "Rejected (On-Chain)",
      bg: tokens.color.errorLight,
      text: tokens.color.error,
      dot: tokens.color.error,
    },
    failed: {
      label: "Failed (On-Chain)",
      bg: tokens.color.errorLight,
      text: tokens.color.error,
      dot: tokens.color.error,
    },
    expired: {
      label: "Expired",
      bg: "#F3F4F6",
      text: "#4B5563",
      dot: "#6B7280",
    },
    suspended: {
      label: "Suspended (On-Chain)",
      bg: tokens.color.warningLight,
      text: tokens.color.warning,
      dot: tokens.color.warning,
    },
    partially_applied: {
      label: "Partially Applied (On-Chain)",
      bg: tokens.color.infoLight,
      text: tokens.color.info,
      dot: tokens.color.info,
    },
    submitted: {
      label: "Submitted",
      bg: tokens.color.surfaceMuted,
      text: tokens.color.navyLight,
      dot: tokens.color.teal,
    },
  };

  const current = statusConfig[status] ?? statusConfig.active;

  return (
    <span
      role="status"
      aria-label={current.label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0.25rem 0.625rem",
        borderRadius: tokens.radius.full,
        fontSize: tokens.typography.fontSize.xs,
        fontWeight: tokens.typography.fontWeight.semibold,
        fontFamily: tokens.typography.fontFamily,
        background: current.bg,
        color: current.text,
        letterSpacing: "0.025em",
        textTransform: "uppercase",
        ...style,
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        style={{
          width: "0.5rem",
          height: "0.5rem",
          borderRadius: "50%",
          background: current.dot,
        }}
      />
      {children ?? current.label}
    </span>
  );
};
