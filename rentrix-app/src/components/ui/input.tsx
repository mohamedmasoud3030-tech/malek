import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, type, lang, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    lang={lang ?? (type === 'date' ? 'en-GB' : undefined)}
    className={cn(
      'flex min-h-12 w-full min-w-0 scroll-mb-16 rounded-xl border border-input bg-background px-3 py-2 text-base outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:text-sm',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
