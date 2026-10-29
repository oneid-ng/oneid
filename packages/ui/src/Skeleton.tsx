import React from "react";
import { tokens } from "./tokens";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export const Skeleton = ({
  width = "100%",
  height = "1.25rem",
  circle = false,
  style,
  ...props
}: SkeletonProps) => {
  return (
    <div
      aria-hidden="true"
      style={{
        display: "block",
        width,
        height,
        borderRadius: circle ? tokens.radius.full : tokens.radius.md,
        background: tokens.color.surfaceMuted,
        opacity: 0.8,
        animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        ...style,
      }}
      {...props}
    />
  );
};
