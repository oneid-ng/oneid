/**
 * @oneid/ui
 *
 * Shared React component library and design tokens.
 * Full component library arrives in the UI/UX workstream (Phase 3).
 *
 * Design tokens follow the README palette:
 *   Deep navy, teal, warm gold accent on warm off-white.
 */

// ── Design tokens ──────────────────────────────────────────────────────────

export const tokens = {
  color: {
    navy: "#0D1F3C",
    teal: "#0B7B8A",
    gold: "#C9972A",
    offWhite: "#FAF8F4",
    errorRed: "#B91C1C",
    successGreen: "#15803D",
  },
  font: {
    sans: "'Inter', system-ui, sans-serif",
  },
} as const;

// ── Placeholder — full components NOT IMPLEMENTED YET ─────────────────────
export const UI_STUB = "NOT IMPLEMENTED YET — components arrive in Phase 3.";
