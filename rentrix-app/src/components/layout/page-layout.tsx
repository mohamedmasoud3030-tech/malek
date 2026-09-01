import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  dir?: 'rtl' | 'ltr';
  size?: 'default' | 'wide' | 'full';
  lang?: string;
  /** Kept for source compatibility while all pages use one visual system. */
  visualVariant?: 'malek-pro';
}

const pageSizes: Record<NonNullable<PageLayoutProps['size']>, string> = {
  default: 'mx-auto w-full max-w-[82rem] xl:max-w-[90rem]',
  wide: 'mx-auto w-full max-w-[96rem] 2xl:max-w-[104rem]',
  full: 'w-full',
};

/**
 * Structural page container only. Visible page identity/actions belong to the
 * single shared PageHeader component so features cannot invent local chrome.
 */
export function PageLayout({
  children,
  className,
  contentClassName,
  dir,
  lang,
  size = 'default',
  visualVariant = 'malek-pro',
}: PageLayoutProps) {
  return (
    <div
      data-page-layout
      data-visual-wave={visualVariant}
      className={cn('min-w-0 overflow-x-clip', className)}
      dir={dir}
      lang={lang}
    >
      <div
        className={cn(
          pageSizes[size],
          'min-w-0 space-y-2.5 sm:space-y-3 md:space-y-3.5 md:pb-6 lg:space-y-5 lg:pb-10',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
