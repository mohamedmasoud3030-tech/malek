import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  dir?: "rtl" | "ltr";
  size?: 'default' | 'wide' | 'full';
}

/**
 * Consistent page wrapper — applies vertical rhythm and bottom padding.
 * Wrap every top-level page with this instead of repeating `space-y-5 pb-6`.
 */
const pageSizes: Record<NonNullable<PageLayoutProps['size']>, string> = {
  default: 'mx-auto w-full max-w-7xl',
  wide: 'mx-auto w-full max-w-[96rem]',
  full: 'w-full',
};

export function PageLayout({ children, className, contentClassName, dir, size = 'default' }: PageLayoutProps) {
  return (
    <div className={cn('min-w-0 overflow-x-clip', className)} dir={dir}>
      <div className={cn(pageSizes[size], 'min-w-0 space-y-5 pb-6', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
