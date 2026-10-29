import React from "react";
import { tokens } from "./tokens.js";

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "success" | "error" | "info" | "warning";
  title?: string;
  message: string;
  onClose?: () => void;
}

export const Toast = ({
  type = "info",
  title,
  message,
  onClose,
  style,
  ...props
}: ToastProps) => {
  const typeConfig: Record<
    string,
    { bg: string; border: string; icon: string; text: string }
  > = {
    success: {
      bg: tokens.color.successLight,
      border: tokens.color.success,
      icon: "✓",
      text: tokens.color.success,
    },
    error: {
      bg: tokens.color.errorLight,
      border: tokens.color.error,
      icon: "⚠",
      text: tokens.color.error,
    },
    warning: {
      bg: tokens.color.warningLight,
      border: tokens.color.warning,
      icon: "!",
      text: tokens.color.warning,
    },
    info: {
      bg: tokens.color.infoLight,
      border: tokens.color.info,
      icon: "ℹ",
      text: tokens.color.info,
    },
  };

  const fallback = typeConfig["info"] as {
    bg: string;
    border: string;
    icon: string;
    text: string;
  };
  const current = typeConfig[type] ?? fallback;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        padding: "0.875rem 1rem",
        borderRadius: tokens.radius.md,
        background: current.bg,
        border: `1px solid ${current.border}`,
        fontFamily: tokens.typography.fontFamily,
        color: tokens.color.textPrimary,
        boxShadow: tokens.shadow.md,
        maxWidth: "28rem",
        ...style,
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        style={{
          fontWeight: "bold",
          color: current.text,
          fontSize: tokens.typography.fontSize.base,
        }}
      >
        {current.icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <h4
            style={{
              margin: "0 0 0.25rem 0",
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: current.text,
            }}
          >
            {title}
          </h4>
        )}
        <p
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.color.textPrimary,
            lineHeight: tokens.typography.lineHeight.normal,
          }}
        >
          {message}
        </p>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          style={{
            background: "transparent",
            border: "none",
            color: tokens.color.textMuted,
            cursor: "pointer",
            padding: "0.25rem",
            fontSize: tokens.typography.fontSize.sm,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};
