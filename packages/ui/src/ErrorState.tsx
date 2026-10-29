import React from "react";
import { tokens } from "./tokens";
import { Button } from "./Button";

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string | undefined;
  message: string;
  code?: string | undefined;
  onRetry?: (() => void) | undefined;
  retryLabel?: string | undefined;
  retrying?: boolean | undefined;
}

export const ErrorState = ({
  title = "Something went wrong",
  message,
  code,
  onRetry,
  retryLabel = "Try again",
  retrying = false,
  style,
  ...props
}: ErrorStateProps) => {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem 1.5rem",
        borderRadius: tokens.radius.lg,
        background: tokens.color.errorLight,
        border: `1.5px solid ${tokens.color.error}`,
        fontFamily: tokens.typography.fontFamily,
        color: tokens.color.textPrimary,
        maxWidth: "32rem",
        margin: "0 auto",
        ...style,
      }}
      {...props}
    >
      <div
        aria-hidden="true"
        style={{
          width: "3rem",
          height: "3rem",
          borderRadius: "50%",
          background: tokens.color.error,
          color: tokens.color.textInverse,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
          fontWeight: "bold",
          marginBottom: "1rem",
        }}
      >
        !
      </div>

      <h3
        style={{
          margin: "0 0 0.5rem 0",
          fontSize: tokens.typography.fontSize.lg,
          fontWeight: tokens.typography.fontWeight.bold,
          color: tokens.color.error,
        }}
      >
        {title}
      </h3>

      {code && (
        <span
          style={{
            display: "inline-block",
            padding: "0.125rem 0.5rem",
            background: tokens.color.surface,
            borderRadius: tokens.radius.sm,
            fontSize: tokens.typography.fontSize.xs,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.color.error,
            border: `1px solid ${tokens.color.error}`,
            marginBottom: "0.75rem",
            fontFamily: "monospace",
          }}
        >
          {code}
        </span>
      )}

      <p
        style={{
          margin: "0 0 1.25rem 0",
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.color.textSecondary,
          lineHeight: tokens.typography.lineHeight.normal,
        }}
      >
        {message}
      </p>

      {onRetry && (
        <Button variant="danger" size="md" onClick={onRetry} loading={retrying}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
};
