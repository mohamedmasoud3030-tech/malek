import { APP_BRAND_NAME, APP_BRAND_TAGLINE_AR } from '@/lib/brand';
import { cn } from '@/lib/utils';

type MalikBrandProps = Readonly<{
  /** Collapsed rail / narrow surface: shrink the wordmark instead of clipping it. */
  compact?: boolean;
  className?: string;
  wordmarkClassName?: string;
  showTagline?: boolean;
  /** Render on a dark surface (sidebar, mobile drawer). */
  inverse?: boolean;
}>;

/**
 * MALIK identity — a text-only wordmark.
 *
 * There is intentionally no logo file, no drawn `M` glyph, and no building or
 * geometric icon: the brand is the product name set in the geometric wordmark
 * face (Sora, applied by the global `.malik-wordmark` rule) while the Arabic
 * tagline stays on Cairo. Do not add an image, an inline SVG, or a decorative
 * letter tile to this component.
 *
 * The compact variant drops to a smaller size and tighter tracking so the full
 * five letters still fit the 4.5rem collapsed sidebar rail without truncating.
 */
export function MalikBrand({
  compact = false,
  className,
  wordmarkClassName,
  showTagline = false,
  inverse = false,
}: MalikBrandProps) {
  return (
    <div className={cn('min-w-0', compact && 'text-center', className)}>
      <p
        dir="ltr"
        aria-label={APP_BRAND_NAME}
        className={cn(
          'malik-wordmark font-extrabold uppercase leading-none',
          compact ? 'text-[0.6875rem] tracking-[0.06em]' : 'truncate text-lg tracking-[0.16em]',
          inverse ? 'text-white' : 'text-foreground',
          wordmarkClassName,
        )}
      >
        {APP_BRAND_NAME}
      </p>
      {showTagline && !compact ? (
        <p
          className={cn(
            'mt-1 truncate text-[10px] font-semibold',
            inverse ? 'text-sidebar-foreground/60' : 'text-muted-foreground',
          )}
        >
          {APP_BRAND_TAGLINE_AR}
        </p>
      ) : null}
    </div>
  );
}
