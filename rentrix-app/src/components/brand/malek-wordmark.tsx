import { MalikBrand } from './malik-brand';
import { cn } from '@/lib/utils';

type MalekBrandWordmarkProps = Readonly<{
  className?: string;
  size?: 'header' | 'sidebar' | 'sm' | 'lg';
}>;

const sizeClasses = {
  header: {
    mark: 'size-10',
    wordmark: 'text-[22px] tracking-[0.08em]',
    gap: 'gap-1.5',
  },
  sidebar: {
    mark: 'size-9',
    wordmark: 'text-[17px] tracking-[0.08em]',
    gap: 'gap-2',
  },
  sm: {
    mark: 'size-7',
    wordmark: 'text-[16px] tracking-[0.08em]',
    gap: 'gap-1.5',
  },
  lg: {
    mark: 'size-12',
    wordmark: 'text-[22px] sm:text-[24px] tracking-[0.1em]',
    gap: 'gap-3',
  },
} as const;

/**
 * Compatibility wrapper for older shell imports.
 *
 * There is only one visible MALEK identity now: the same MalikBrand + MalikMark
 * lockup used on the login screen. This wrapper only adapts dimensions for the
 * available surface; it must not draw its own M or brand text.
 */
export function MalekBrandWordmark({ className, size = 'header' }: MalekBrandWordmarkProps) {
  const sizing = sizeClasses[size];

  return (
    <span
      data-malek-brand-wordmark
      data-header-wordmark={size === 'header' ? 'true' : undefined}
      data-variant={size}
      className={cn('inline-flex min-w-0', size === 'sidebar' && 'w-full justify-center', className)}
    >
      <MalikBrand
        layout="horizontal"
        inverse={size === 'sidebar'}
        className={sizing.gap}
        markClassName={sizing.mark}
        wordmarkClassName={sizing.wordmark}
      />
    </span>
  );
}
