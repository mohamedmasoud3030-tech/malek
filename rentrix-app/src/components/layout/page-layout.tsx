import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  dir?: 'rtl' | 'ltr';
  size?: 'default' | 'wide' | 'full';
  lang?: string;
}

/**
 * Consistent top-level page wrapper.
 *
 * The wrapper owns horizontal containment, vertical rhythm and the mobile-safe
 * bottom breathing room. Feature pages should not add their own outer cards or
 * duplicate page-width/padding rules around this component.
 */
const pageSizes: Record<NonNullable<PageLayoutProps['size']>, string> = {
  default: 'mx-auto w-full max-w-7xl',
  wide: 'mx-auto w-full max-w-[96rem]',
  full: 'w-full',
};

export function PageLayout({ children, className, contentClassName, dir, lang, size = 'default' }: PageLayoutProps) {
  return (
    <div
      data-page-layout
      className={cn('min-w-0 overflow-x-clip', className)}
      dir={dir}
      lang={lang}
    >
      <div
        className={cn(
          pageSizes[size],
          'min-w-0 space-y-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:space-y-5 sm:pb-8',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
