import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, type, lang, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    lang={lang ?? (type === 'date' ? 'en-GB' : undefined)}
    className={cn(
      'flex min-h-10 w-full min-w-0 scroll-mb-16 rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
