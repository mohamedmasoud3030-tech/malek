import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  dir?: 'rtl' | 'ltr';
  size?: 'default' | 'wide' | 'full';
  lang?: string;
  /** Scoped visual system for approved operational workspaces only. */
  visualVariant?: 'malek-pro';
}

/**
 * Consistent top-level page wrapper.
 * Every feature page MUST wrap content in <PageLayout>.
 * No page should set its own max-width or page-level padding.
 */
const pageSizes: Record<NonNullable<PageLayoutProps['size']>, string> = {
  default: 'mx-auto w-full max-w-7xl',
  wide: 'mx-auto w-full max-w-[96rem]',
  full: 'w-full',
};

export function PageLayout({
  children,
  className,
  contentClassName,
  dir,
  lang,
  size = 'default',
  visualVariant,
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
          'min-w-0 space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:space-y-6 sm:pb-8',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
