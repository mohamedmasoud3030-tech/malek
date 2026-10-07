import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex min-h-12 w-full min-w-0 scroll-mb-16 rounded-xl border border-input bg-background px-3 py-2 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:text-sm',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
