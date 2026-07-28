import { cn } from '@/lib/utils';

type MalikMarkProps = Readonly<{
  className?: string;
}>;

/**
 * The compact MALIK mark used where the full wordmark would be illegible:
 * app icons, the collapsed navigation rail, and compact brand lockups.
 *
 * The public SVG is deliberately the single source used by runtime UI. Keeping
 * it isolated means an approved final master logo can replace it without
 * changing any user-facing layout; the PWA export sources live alongside it.
 */
export function MalikMark({ className }: MalikMarkProps) {
  return <img src="/malik-mark.svg" alt="" aria-hidden="true" className={cn('block shrink-0', className)} />;
}
