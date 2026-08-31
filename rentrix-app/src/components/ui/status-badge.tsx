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

/**
 * Semantic status tokens are HSL channel custom properties, not Tailwind
 * `--color-*` theme entries. Use explicit arbitrary color utilities so the
 * browser resolves the canonical runtime tokens instead of silently emitting
 * a transparent background when a generated color utility is unavailable.
 */
const semanticTones: Record<SemanticTone, string> = {
  success: 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success-text))] ring-[hsl(var(--success-text)/0.2)]',
  warning: 'bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-text))] ring-[hsl(var(--warning-text)/0.2)]',
  danger: 'bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger-text))] ring-[hsl(var(--danger-text)/0.2)]',
  info: 'bg-[hsl(var(--info-bg))] text-[hsl(var(--info-text))] ring-[hsl(var(--info-text)/0.2)]',
  neutral: 'bg-[hsl(var(--neutral-bg))] text-[hsl(var(--neutral-text))] ring-[hsl(var(--neutral-text)/0.2)]',
  primary: 'bg-primary/10 text-primary ring-primary/20',
  secondary: 'bg-[hsl(var(--neutral-bg))] text-[hsl(var(--neutral-text))] ring-[hsl(var(--neutral-text)/0.2)]',
};

const semanticDotTones: Record<SemanticTone, string> = {
  success: 'bg-[hsl(var(--success-text))]',
  warning: 'bg-[hsl(var(--warning-text))]',
  danger: 'bg-[hsl(var(--danger-text))]',
  info: 'bg-[hsl(var(--info-text))]',
  neutral: 'bg-[hsl(var(--neutral-text))]',
  primary: 'bg-primary',
  secondary: 'bg-[hsl(var(--neutral-text))]',
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