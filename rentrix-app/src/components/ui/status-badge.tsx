import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Semantic tones — canonical for new code. */
type SemanticTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' | 'secondary';

/** Product accents shared by light and dark themes. */
type ProductTone = 'emerald' | 'amber' | 'sky' | 'rose' | 'violet' | 'slate';

/** Legacy color tones — kept for compatibility and resolved to product accents. */
type LegacyTone = 'blue' | 'green' | 'red' | 'gray' | 'gold';

type StatusTone = SemanticTone | ProductTone | LegacyTone;
type ResolvedTone = SemanticTone | ProductTone;

const legacyToProduct: Record<LegacyTone, ProductTone> = {
  blue: 'sky',
  green: 'emerald',
  red: 'rose',
  gray: 'slate',
  gold: 'amber',
};

const semanticTones: Record<SemanticTone, string> = {
  success: 'bg-success/10 text-success ring-success/20',
  warning: 'bg-warning/10 text-warning ring-warning/20',
  danger: 'bg-danger/10 text-danger ring-danger/20',
  info: 'bg-info/10 text-info ring-info/20',
  neutral: 'bg-neutral/10 text-neutral ring-neutral/20',
  primary: 'bg-primary/10 text-primary ring-primary/20',
  secondary: 'bg-neutral/10 text-neutral ring-neutral/20',
};

const semanticDotTones: Record<SemanticTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-neutral',
  primary: 'bg-primary',
  secondary: 'bg-neutral',
};

const productTones = new Set<ProductTone>(['emerald', 'amber', 'sky', 'rose', 'violet', 'slate']);

function resolveTone(tone: StatusTone): ResolvedTone {
  if (tone in legacyToProduct) return legacyToProduct[tone as LegacyTone];
  return tone as ResolvedTone;
}

/**
 * StatusBadge — the single status indicator for the application.
 *
 * Semantic tones remain suitable for business meaning. Product accents are
 * available when a page needs stronger visual grouping without hard-coded
 * light-only Tailwind colors.
 */
export function StatusBadge({
  tone,
  children,
  className,
  dot = false,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  const resolved = resolveTone(tone);
  const isProductTone = productTones.has(resolved as ProductTone);

  return (
    <span
      data-status-badge
      data-tone={resolved}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
        isProductTone ? 'ring-transparent' : semanticTones[resolved as SemanticTone],
        className,
      )}
    >
      {dot ? (
        <span
          data-status-dot
          className={cn(
            'size-1.5 rounded-full',
            isProductTone ? undefined : semanticDotTones[resolved as SemanticTone],
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
