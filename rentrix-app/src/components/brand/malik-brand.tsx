import { APP_BRAND_NAME, APP_BRAND_TAGLINE_AR } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { MalikMark } from './malik-mark';

type MalikBrandProps = Readonly<{
  /** Collapsed rail / narrow surface: render the mark where text would be illegible. */
  compact?: boolean;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showTagline?: boolean;
  /** Render on a dark surface (sidebar, mobile drawer). */
  inverse?: boolean;
}>;

/**
 * MALEK identity lockup. The internal component name is retained as a safe
 * compatibility boundary, while all visible text and assets use MALEK.
 */
export function MalikBrand({
  compact = false,
  className,
  markClassName,
  wordmarkClassName,
  showTagline = false,
  inverse = false,
}: MalikBrandProps) {
  if (compact) {
    return (
      <div role="img" className={cn('grid place-items-center', className)} aria-label={APP_BRAND_NAME}>
        <MalikMark className={cn('size-9', markClassName)} />
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)} data-malek-brand-lockup>
      <MalikMark className={cn('size-9', markClassName)} />
      <div className="min-w-0">
        <p
          dir="ltr"
          aria-label={APP_BRAND_NAME}
          className={cn(
            'malik-wordmark malek-wordmark truncate text-lg font-extrabold uppercase leading-none tracking-[0.16em]',
            inverse ? 'text-white' : 'text-foreground',
            wordmarkClassName,
          )}
        >
          {APP_BRAND_NAME}
        </p>
        {showTagline ? (
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
    </div>
  );
}
