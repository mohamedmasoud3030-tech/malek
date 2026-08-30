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
  /** Layout direction for the lockup. Vertical puts M above MALEK. */
  layout?: 'horizontal' | 'vertical';
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
  layout = 'horizontal',
}: MalikBrandProps) {
  if (compact) {
    return (
      <div role="img" className={cn('grid place-items-center', className)} aria-label={APP_BRAND_NAME}>
        <MalikMark className={cn('size-10', markClassName)} />
      </div>
    );
  }

  if (layout === 'vertical') {
    return (
      <div className={cn('flex flex-col items-center gap-3.5', className)} data-malek-brand-lockup data-layout="vertical">
        <MalikMark className={cn('size-14 sm:size-16', markClassName)} />
        <div className="flex flex-col items-center">
          <p
            dir="ltr"
            aria-label={APP_BRAND_NAME}
            className={cn(
              'malik-wordmark malek-wordmark text-center text-[1.65rem] font-extrabold uppercase leading-none tracking-[0.12em] sm:text-[1.85rem]',
              inverse ? 'text-white' : 'text-foreground',
              wordmarkClassName,
            )}
          >
            {APP_BRAND_NAME}
          </p>
          {showTagline ? (
            <p
              className={cn(
                'mt-2.5 text-center text-[13px] font-medium leading-5 tracking-wide sm:text-sm',
                inverse ? 'text-sidebar-foreground/70' : 'text-muted-foreground',
              )}
            >
              {APP_BRAND_TAGLINE_AR}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)} data-malek-brand-lockup data-layout="horizontal">
      <MalikMark className={cn('size-10', markClassName)} />
      <div className="min-w-0">
        <p
          dir="ltr"
          aria-label={APP_BRAND_NAME}
          className={cn(
            'malik-wordmark malek-wordmark truncate text-[18px] font-extrabold uppercase leading-none tracking-[0.08em]',
            inverse ? 'text-white' : 'text-foreground',
            wordmarkClassName,
          )}
        >
          {APP_BRAND_NAME}
        </p>
        {showTagline ? (
          <p
            className={cn(
              'mt-1 truncate text-xs font-semibold leading-tight',
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
