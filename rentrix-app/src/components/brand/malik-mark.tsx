import { APP_BRAND_MARK_ASSET } from '@/lib/brand';
import { cn } from '@/lib/utils';

type MalikMarkProps = Readonly<{
  className?: string;
}>;

/**
 * Compatibility component name; the visible identity and canonical asset are
 * MALEK. Every compact brand surface consumes the same angular mark source.
 */
export function MalikMark({ className }: MalikMarkProps) {
  return (
    <img
      src={APP_BRAND_MARK_ASSET}
      alt=""
      aria-hidden="true"
      className={cn('block shrink-0 object-contain', className)}
      data-malek-canonical-mark
    />
  );
}
