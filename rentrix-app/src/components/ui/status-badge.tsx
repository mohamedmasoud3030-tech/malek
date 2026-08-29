import { Children, isValidElement, type ReactNode } from 'react';
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

const productToSemantic: Record<ProductTone, SemanticTone> = {
  emerald: 'success',
  amber: 'warning',
  sky: 'info',
  rose: 'danger',
  violet: 'primary',
  slate: 'neutral',
};

const semanticTones: Record<SemanticTone, string> = {
  success: 'bg-success-bg text-success-text ring-success/20',
  warning: 'bg-warning-bg text-warning-text ring-warning/20',
  danger: 'bg-danger-bg text-danger-text ring-danger/20',
  info: 'bg-info-bg text-info-text ring-info/20',
  neutral: 'bg-neutral-bg text-neutral-text ring-neutral/20',
  primary: 'bg-primary/10 text-primary ring-primary/20',
  secondary: 'bg-neutral-bg text-neutral-text ring-neutral/20',
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

function resolveTone(tone: StatusTone): ResolvedTone {
  if (tone in legacyToProduct) return legacyToProduct[tone as LegacyTone];
  return tone as ResolvedTone;
}

function resolveVisualTone(tone: ResolvedTone): SemanticTone {
  if (tone in productToSemantic) return productToSemantic[tone as ProductTone];
  return tone as SemanticTone;
}

function containsCustomStatusIndicator(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return false;
    return Boolean(child.props['data-status-dot'] || child.props['data-finance-status-icon']);
  });
}

/**
 * StatusBadge — the single status indicator for the application.
 *
 * Semantic tones remain suitable for business meaning. Product accents retain
 * their public tone names while resolving through the same canonical semantic
 * token graph, so both light and dark themes always render a visible state.
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
  const visualTone = resolveVisualTone(resolved);
  const shouldRenderDefaultDot = dot && !containsCustomStatusIndicator(children);

  return (
    <span
      data-status-badge
      data-tone={resolved}
      className={cn(
        'inline-flex min-h-6 max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-5 ring-1 ring-inset [overflow-wrap:anywhere]',
        semanticTones[visualTone],
        className,
      )}
    >
      {shouldRenderDefaultDot ? (
        <span
          data-status-dot
          aria-hidden="true"
          className={cn('size-1.5 rounded-full', semanticDotTones[visualTone])}
        />
      ) : null}
      {children}
    </span>
  );
}
