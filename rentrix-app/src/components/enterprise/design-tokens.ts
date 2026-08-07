/**
 * Enterprise UX Foundation — Design Tokens (Wave 4A)
 *
 * Typed, programmatic view of the design tokens that already exist as CSS
 * custom properties in `src/styles/tokens.css` (Wave 3). This module does NOT
 * introduce new visual values: every entry either names an existing CSS
 * variable or an existing Tailwind utility scale so components and future
 * modules can consume tokens from TypeScript without hard-coding values.
 *
 * Nothing here is module-specific. Import freely from any enterprise layer.
 */

// ── Spacing ──────────────────────────────────────────────────────────────────
/** 4px-base spacing scale. Values match `--space-*` in tokens.css. */
export const spacing = {
  1: 'var(--space-1)',
  2: 'var(--space-2)',
  3: 'var(--space-3)',
  4: 'var(--space-4)',
  5: 'var(--space-5)',
  6: 'var(--space-6)',
  8: 'var(--space-8)',
  10: 'var(--space-10)',
  12: 'var(--space-12)',
  16: 'var(--space-16)',
} as const;
export type SpacingToken = keyof typeof spacing;

// ── Radius ───────────────────────────────────────────────────────────────────
/** Corner radii exposed by tokens.css / the Tailwind radius scale. */
export const radius = {
  xs: 'var(--radius-2xs)',
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  lg: 'var(--radius)',
  card: 'var(--radius-card)',
  elevated: 'var(--radius-elevated)',
  full: 'var(--radius-full)',
} as const;
export type RadiusToken = keyof typeof radius;

// ── Elevation ────────────────────────────────────────────────────────────────
/** Elevation levels → Tailwind shadow utilities bridged from tokens.css. */
export const elevation = {
  none: 'shadow-none',
  card: 'shadow-card',
  cardHover: 'shadow-card-hover',
  elevated: 'shadow-elevated',
  sidebar: 'shadow-sidebar',
} as const;
export type ElevationToken = keyof typeof elevation;

// ── Transitions ──────────────────────────────────────────────────────────────
/** Motion duration/easing tokens (`--duration-*`, `--motion-ease-*`). */
export const transition = {
  duration: { fast: 'var(--duration-fast)', base: 'var(--duration-base)', slow: 'var(--duration-slow)' },
  ease: { standard: 'var(--motion-ease-standard)', emphasized: 'var(--motion-ease-emphasized)' },
  /** Ready-to-use Tailwind transition presets aligned with the token scale. */
  className: {
    colors: 'transition-colors duration-200 ease-out',
    transform: 'transition-transform duration-200 ease-out',
    all: 'transition-all duration-200 ease-out',
    opacity: 'transition-opacity duration-150 ease-out',
  },
} as const;

// ── Status Colors ────────────────────────────────────────────────────────────
/**
 * Semantic status tones shared by badges, alerts, inputs, and rows.
 * Class pairs read from tokens.css semantic palette (light/dark aware).
 */
export const statusTones = ['success', 'warning', 'danger', 'info', 'neutral'] as const;
export type StatusTone = (typeof statusTones)[number];

export const statusColors: Record<StatusTone, { text: string; bg: string; ring: string; soft: string }> = {
  success: { text: 'text-success', bg: 'bg-success-bg', ring: 'ring-success/20', soft: 'bg-success/10' },
  warning: { text: 'text-warning', bg: 'bg-warning-bg', ring: 'ring-warning/20', soft: 'bg-warning/10' },
  danger: { text: 'text-danger', bg: 'bg-danger-bg', ring: 'ring-danger/20', soft: 'bg-danger/10' },
  info: { text: 'text-info', bg: 'bg-info-bg', ring: 'ring-info/20', soft: 'bg-info/10' },
  neutral: { text: 'text-neutral', bg: 'bg-neutral-bg', ring: 'ring-neutral/20', soft: 'bg-neutral/10' },
};

// ── Semantic Colors ──────────────────────────────────────────────────────────
/** Foreground/background semantic pairs (shadcn-style semantic variables). */
export const semanticColors = {
  canvas: 'bg-background text-foreground',
  surface: 'bg-card text-card-foreground',
  surfaceMuted: 'bg-muted text-muted-foreground',
  primary: 'bg-primary text-primary-foreground',
  accent: 'text-primary',
  border: 'border-border',
  divider: 'divide-border',
} as const;
export type SemanticColorToken = keyof typeof semanticColors;

// ── Responsive Breakpoints ───────────────────────────────────────────────────
/**
 * Viewport breakpoints in px — identical to the Tailwind defaults the app
 * already compiles against (`sm:` … `2xl:`). Use with `matchMedia` when JS
 * needs the same decisions CSS makes.
 */
export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const;
export type Breakpoint = keyof typeof breakpoints;

/** Media query helpers matching `breakpoints` (mobile-first `min-width`). */
export const mediaQueries: Record<Breakpoint, string> = {
  sm: `(min-width: ${breakpoints.sm}px)`,
  md: `(min-width: ${breakpoints.md}px)`,
  lg: `(min-width: ${breakpoints.lg}px)`,
  xl: `(min-width: ${breakpoints.xl}px)`,
  '2xl': `(min-width: ${breakpoints['2xl']}px)`,
};

/** True when the viewport is at least `breakpoint`. SSR-safe (false on server). */
export function matchesBreakpoint(breakpoint: Breakpoint): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(mediaQueries[breakpoint]).matches;
}

// ── Icon Sizing ──────────────────────────────────────────────────────────────
/** Icon sizes → Tailwind size utilities matching `--icon-*` tokens. */
export const iconSizes = {
  xs: 'size-3.5',
  sm: 'size-4',
  md: 'size-[1.125rem]',
  lg: 'size-5',
  xl: 'size-6',
} as const;
export type IconSize = keyof typeof iconSizes;

// ── Typography ───────────────────────────────────────────────────────────────
/**
 * Composable text presets mirroring `components/ui/typography.tsx`. Use these
 * class strings when building *container* structures (tables, toolbars) where
 * the Typography component itself isn't the right wrapper.
 */
export const typographyPresets = {
  pageTitle: 'text-lg font-bold leading-7 sm:text-xl',
  sectionTitle: 'text-[0.9375rem] font-semibold leading-6',
  body: 'text-sm leading-6',
  bodyMuted: 'text-sm leading-6 text-muted-foreground',
  captionMuted: 'text-xs leading-5 text-muted-foreground',
  tableHeader: 'text-xs font-semibold text-muted-foreground',
  stat: 'text-xl font-bold tabular-nums sm:text-2xl',
  overline: 'text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground',
} as const;
export type TypographyPreset = keyof typeof typographyPresets;

// ── Z-index ──────────────────────────────────────────────────────────────────
/** Overlay stacking order, kept in sync with `--z-*` tokens. */
export const zIndex = {
  dropdown: 'var(--z-dropdown)',
  sticky: 'var(--z-sticky)',
  overlay: 'var(--z-overlay)',
  modal: 'var(--z-modal)',
  toast: 'var(--z-toast)',
} as const;

export const enterpriseDesignTokens = {
  spacing,
  radius,
  elevation,
  transition,
  statusTones,
  statusColors,
  semanticColors,
  breakpoints,
  mediaQueries,
  iconSizes,
  typographyPresets,
  zIndex,
} as const;
