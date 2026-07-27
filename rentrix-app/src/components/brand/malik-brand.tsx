import { cn } from '@/lib/utils';
import { APP_BRAND_NAME, APP_BRAND_TAGLINE_AR } from '@/lib/brand';

type MalikBrandProps = Readonly<{
  compact?: boolean;
  className?: string;
  wordmarkClassName?: string;
  showTagline?: boolean;
  inverse?: boolean;
}>;

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
          'malik-wordmark truncate text-lg font-extrabold uppercase leading-none',
          inverse ? 'text-white' : 'text-foreground',
          compact && 'text-base',
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
