import React from "react";
import { tokens } from "./tokens.js";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "elevated" | "bordered";
}

export const Card = ({ children, variant = "default", style, ...props }: CardProps) => {
  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      background: tokens.color.surface,
      border: `1px solid ${tokens.color.border}`,
      boxShadow: tokens.shadow.sm,
    },
    elevated: {
      background: tokens.color.surface,
      border: "1px solid transparent",
      boxShadow: tokens.shadow.md,
    },
    bordered: {
      background: tokens.color.surface,
      border: `1.5px solid ${tokens.color.borderStrong}`,
      boxShadow: "none",
    },
  };

  return (
    <div
      style={{
        borderRadius: tokens.radius.lg,
        padding: "1.25rem",
        fontFamily: tokens.typography.fontFamily,
        color: tokens.color.textPrimary,
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({
  children,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    style={{
      marginBottom: "0.75rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.25rem",
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle = ({
  children,
  style,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3
    style={{
      margin: 0,
      fontSize: tokens.typography.fontSize.lg,
      fontWeight: tokens.typography.fontWeight.semibold,
      color: tokens.color.navy,
      ...style,
    }}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription = ({
  children,
  style,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    style={{
      margin: 0,
      fontSize: tokens.typography.fontSize.sm,
      color: tokens.color.textSecondary,
      ...style,
    }}
    {...props}
  >
    {children}
  </p>
);

export const CardContent = ({
  children,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div style={{ ...style }} {...props}>
    {children}
  </div>
);

export const CardFooter = ({
  children,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    style={{
      marginTop: "1rem",
      paddingTop: "0.75rem",
      borderTop: `1px solid ${tokens.color.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: "0.5rem",
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);
