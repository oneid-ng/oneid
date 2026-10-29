import React from "react";
import { tokens } from "./tokens.js";

export interface StepItem {
  title: string;
  description?: string;
}

export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: StepItem[];
  currentStep: number; // 0-indexed
}

export const Stepper = ({ steps, currentStep, style, ...props }: StepperProps) => {
  return (
    <nav aria-label="Progress" style={{ width: "100%", ...style }} {...props}>
      <ol
        role="list"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          listStyle: "none",
          padding: 0,
          margin: 0,
          position: "relative",
          width: "100%",
        }}
      >
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          const circleBg = isCompleted
            ? tokens.color.teal
            : isCurrent
              ? tokens.color.navy
              : tokens.color.surfaceMuted;

          const circleColor =
            isCompleted || isCurrent ? tokens.color.textInverse : tokens.color.textMuted;

          return (
            <li
              key={step.title}
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                flex: 1,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  background: circleBg,
                  color: circleColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.bold,
                  fontFamily: tokens.typography.fontFamily,
                  zIndex: 2,
                  boxShadow: isCurrent ? `0 0 0 3px ${tokens.color.gold}` : "none",
                  transition: "background 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                {isCompleted ? "✓" : index + 1}
              </div>

              <span
                style={{
                  marginTop: "0.5rem",
                  fontSize: tokens.typography.fontSize.xs,
                  fontWeight: isCurrent
                    ? tokens.typography.fontWeight.bold
                    : tokens.typography.fontWeight.medium,
                  color: isCurrent ? tokens.color.navy : tokens.color.textSecondary,
                  fontFamily: tokens.typography.fontFamily,
                }}
              >
                {step.title}
              </span>

              {step.description && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: tokens.color.textMuted,
                    fontFamily: tokens.typography.fontFamily,
                  }}
                >
                  {step.description}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
