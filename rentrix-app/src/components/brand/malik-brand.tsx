import { cn } from '@/lib/utils';
import { APP_BRAND_NAME, APP_BRAND_TAGLINE_AR } from '@/lib/brand';

type MalikMarkProps = Readonly<{
  className?: string;
  title?: string;
}>;

export function MalikMark({ className, title = 'MALIK' }: MalikMarkProps) {
  const titleId = `malik-mark-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-labelledby={titleId}
      className={cn('shrink-0', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id={titleId}>{title}</title>
      <path
        d="M8 52V17.5L21.5 29 32 18l10.5 11L56 17.5V52"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 52h48" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M18 39h5M41 39h5" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

type MalikBrandProps = Readonly<{
  compact?: boolean;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showTagline?: boolean;
  inverse?: boolean;
}>;

export function MalikBrand({
  compact = false,
  className,
  markClassName,
  wordmarkClassName,
  showTagline = false,
  inverse = false,
}: MalikBrandProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', compact && 'justify-center', className)}>
      <div
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-xl border shadow-sm',
          inverse
            ? 'border-white/15 bg-white/8 text-white'
            : 'border-primary/20 bg-primary/10 text-primary',
        )}
      >
        <MalikMark className={cn('size-7', markClassName)} />
      </div>

      {compact ? null : (
        <div className="min-w-0">
          <p
            dir="ltr"
            className={cn(
              'malik-wordmark truncate text-lg font-extrabold uppercase leading-none',
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
      )}
    </div>
  );
}
