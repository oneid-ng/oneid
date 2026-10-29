/**
 * @oneid/ui
 *
 * Shared React component library and design tokens for ONEiD (README §17).
 * Design tokens follow the palette: deep navy, teal, warm gold accent on warm off-white.
 * All components meet WCAG 2.1 AA accessibility targets with keyboard navigation and contrast.
 */

export { tokens, type DesignTokens } from "./tokens";
export { Button, type ButtonProps } from "./Button";
export { Input, type InputProps } from "./Input";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
} from "./Card";
export { Badge, type BadgeProps, type OnChainStatus } from "./Badge";
export { Stepper, type StepperProps, type StepItem } from "./Stepper";
export { Toast, type ToastProps } from "./Toast";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
