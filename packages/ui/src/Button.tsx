import React from "react";
import { tokens } from "./tokens.js";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  success?: boolean;
  error?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      success = false,
      error = false,
      disabled = false,
      children,
      style,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    // Size styles
    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: { padding: "0.375rem 0.75rem", fontSize: tokens.typography.fontSize.sm },
      md: { padding: "0.5rem 1rem", fontSize: tokens.typography.fontSize.base },
      lg: { padding: "0.75rem 1.5rem", fontSize: tokens.typography.fontSize.lg },
    };

    // Variant styles
    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        background: error
          ? tokens.color.error
          : success
            ? tokens.color.success
            : tokens.color.navy,
        color: tokens.color.textInverse,
        border: "1px solid transparent",
      },
      secondary: {
        background: tokens.color.teal,
        color: tokens.color.textInverse,
        border: "1px solid transparent",
      },
      outline: {
        background: "transparent",
        color: tokens.color.navy,
        border: `1.5px solid ${tokens.color.navy}`,
      },
      danger: {
        background: tokens.color.error,
        color: tokens.color.textInverse,
        border: "1px solid transparent",
      },
      ghost: {
        background: "transparent",
        color: tokens.color.navy,
        border: "1px solid transparent",
      },
    };

    const baseStyle: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.5rem",
      fontFamily: tokens.typography.fontFamily,
      fontWeight: tokens.typography.fontWeight.semibold,
      lineHeight: tokens.typography.lineHeight.tight,
      borderRadius: tokens.radius.md,
      cursor: isDisabled ? "not-allowed" : "pointer",
      opacity: isDisabled ? 0.65 : 1,
      transition: "background 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease",
      outline: "none",
      boxShadow: "none",
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style,
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading ? "true" : "false"}
        aria-disabled={isDisabled ? "true" : "false"}
        style={baseStyle}
        {...props}
      >
        {loading && (
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: "1em",
              height: "1em",
              border: "2px solid currentColor",
              borderRightColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.75s linear infinite",
            }}
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
