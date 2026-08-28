import { APP_BRAND_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

type MalekBrandWordmarkProps = Readonly<{
  className?: string;
  size?: 'header' | 'sidebar' | 'sm' | 'lg';
}>;

/**
 * MALEK final wordmark — M Malek where M is visually larger than Malek.
 * No icon container, no background tile, theme-aware colors.
 * - Light header: M = primary (royal blue), Malek = foreground (dark readable)
 * - Dark header: M = primary (light blue visible), Malek = foreground (light)
 * - Sidebar (dark navy): M = white, Malek = white/92 via CSS [data-sidebar] override
 * Real wordmark, not icon+label.
 */
export function MalekBrandWordmark({ className, size = 'header' }: MalekBrandWordmarkProps) {
  return (
    <span
      data-malek-brand-wordmark
      data-variant={size}
      dir="ltr"
      aria-label={APP_BRAND_NAME}
      className={cn(
        'inline-flex items-baseline gap-[0.22em] select-none whitespace-nowrap leading-none',
        size === 'header' && 'text-[19px] sm:text-[20px]',
        size === 'sidebar' && 'text-[20px] lg:text-[22px]',
        size === 'sm' && 'text-[16px]',
        size === 'lg' && 'text-[24px] sm:text-[26px]',
        className,
      )}
    >
      <span data-brand-m className="font-black tracking-[-0.02em] leading-[0.9] text-[1.55em]" aria-hidden="true">
        M
      </span>
      <span data-brand-name className="font-bold tracking-[0.12em] uppercase leading-none text-[1em]">
        Malek
      </span>
    </span>
  );
}

// Alias for compatibility
export const MalekWordmark = MalekBrandWordmark;
