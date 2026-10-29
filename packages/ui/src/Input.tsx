import React, { useId } from "react";
import { tokens } from "./tokens.js";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, id: propId, required, disabled, style, ...props }, ref) => {
    const generatedId = useId();
    const inputId = propId ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          width: "100%",
        }}
      >
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontFamily: tokens.typography.fontFamily,
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              color: tokens.color.textPrimary,
            }}
          >
            {label}
            {required && (
              <span
                aria-hidden="true"
                style={{ color: tokens.color.error, marginLeft: "0.25rem" }}
              >
                *
              </span>
            )}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          required={required}
          disabled={disabled}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={describedBy}
          style={{
            fontFamily: tokens.typography.fontFamily,
            fontSize: tokens.typography.fontSize.base,
            padding: "0.5rem 0.75rem",
            borderRadius: tokens.radius.md,
            border: `1.5px solid ${error ? tokens.color.error : tokens.color.borderStrong}`,
            background: disabled ? tokens.color.surfaceMuted : tokens.color.surface,
            color: tokens.color.textPrimary,
            outline: "none",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            ...style,
          }}
          {...props}
        />

        {hint && !error && (
          <p
            id={hintId}
            style={{
              margin: 0,
              fontFamily: tokens.typography.fontFamily,
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.color.textMuted,
            }}
          >
            {hint}
          </p>
        )}

        {error && (
          <p
            id={errorId}
            role="alert"
            style={{
              margin: 0,
              fontFamily: tokens.typography.fontFamily,
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.color.error,
              fontWeight: tokens.typography.fontWeight.medium,
            }}
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
