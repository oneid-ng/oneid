/**
 * @oneid/ui
 *
 * Shared React component library and design tokens for ONEiD (README §17).
 * Design tokens follow the palette: deep navy, teal, warm gold accent on warm off-white.
 * All components meet WCAG 2.1 AA accessibility targets with keyboard navigation and contrast.
 */

export { tokens, type DesignTokens } from "./tokens.js";
export { Button, type ButtonProps } from "./Button.js";
export { Input, type InputProps } from "./Input.js";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  type CardProps,
} from "./Card.js";
export { Badge, type BadgeProps, type OnChainStatus } from "./Badge.js";
export { Stepper, type StepperProps, type StepItem } from "./Stepper.js";
export { Toast, type ToastProps } from "./Toast.js";
export { Skeleton, type SkeletonProps } from "./Skeleton.js";
export { ErrorState, type ErrorStateProps } from "./ErrorState.js";
