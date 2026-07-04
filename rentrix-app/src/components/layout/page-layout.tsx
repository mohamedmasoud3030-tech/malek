import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  dir?: "rtl" | "ltr";
}

/**
 * Consistent page wrapper — applies vertical rhythm and bottom padding.
 * Wrap every top-level page with this instead of repeating `space-y-5 pb-6`.
 */
export function PageLayout({ children, className, dir }: PageLayoutProps) {
  return (
    <div className={cn('space-y-5 pb-6', className)} dir={dir}>
      {children}
    </div>
  );
}
