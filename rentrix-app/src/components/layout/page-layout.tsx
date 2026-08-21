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
          'min-w-0 space-y-3 pb-3 sm:space-y-4 sm:pb-5 md:space-y-4 md:pb-6',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
