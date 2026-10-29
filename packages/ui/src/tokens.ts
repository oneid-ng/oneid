/**
 * packages/ui/src/tokens.ts
 *
 * ONEiD Design Tokens (README §17).
 * Palette follows the deck: deep navy, teal, warm gold accent on warm off-white.
 * WCAG 2.1 AA compliant contrast ratios.
 */

export const tokens = {
  color: {
    // Primary palette
    navy: "#0D1F3C", // Deep Navy
    navyLight: "#1B3358",
    navyDark: "#071224",
    teal: "#0B7B8A", // Teal
    tealLight: "#1299AB",
    tealDark: "#065A65",
    gold: "#C9972A", // Warm Gold accent
    goldLight: "#E5B64E",
    goldDark: "#9E7216",
    offWhite: "#FAF8F4", // Warm off-white background
    surface: "#FFFFFF",
    surfaceMuted: "#F3EFE6",

    // Status colors
    success: "#15803D",
    successLight: "#DCFCE7",
    error: "#B91C1C",
    errorLight: "#FEE2E2",
    warning: "#B45309",
    warningLight: "#FEF3C7",
    info: "#1D4ED8",
    infoLight: "#DBEAFE",

    // Text & Border
    textPrimary: "#0D1F3C",
    textSecondary: "#4B5563",
    textMuted: "#6B7280",
    textInverse: "#FFFFFF",
    border: "#E5E7EB",
    borderStrong: "#CBD5E1",
    focusRing: "#0B7B8A",
  },
  typography: {
    fontFamily:
      "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: {
      xs: "0.75rem", // 12px
      sm: "0.875rem", // 14px
      base: "1rem", // 16px
      lg: "1.125rem", // 18px
      xl: "1.25rem", // 20px
      "2xl": "1.5rem", // 24px
      "3xl": "1.875rem", // 30px
      "4xl": "2.25rem", // 36px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    0: "0",
    1: "0.25rem", // 4px
    2: "0.5rem", // 8px
    3: "0.75rem", // 12px
    4: "1rem", // 16px
    5: "1.25rem", // 20px
    6: "1.5rem", // 24px
    8: "2rem", // 32px
    10: "2.5rem", // 40px
    12: "3rem", // 48px
    16: "4rem", // 64px
  },
  radius: {
    none: "0",
    sm: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    full: "9999px",
  },
  shadow: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  },
} as const;

export type DesignTokens = typeof tokens;
