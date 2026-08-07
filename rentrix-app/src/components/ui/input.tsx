import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const inputVariants = cva(
  [
    'flex min-h-10 w-full min-w-0 scroll-mb-16 rounded-lg border bg-card px-3 py-2 text-sm outline-none transition',
    'placeholder:text-muted-foreground',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'read-only:cursor-default read-only:bg-muted/40 read-only:opacity-100',
    'motion-reduce:transition-none',
  ].join(' '),
  {
    variants: {
      state: {
        default: 'border-input focus:border-primary focus:ring-2 focus:ring-primary/15',
        error:
          'border-destructive/70 text-foreground focus:border-destructive focus:ring-2 focus:ring-destructive/20',
        warning:
          'border-warning/70 focus:border-warning focus:ring-2 focus:ring-warning/20',
        success:
          'border-success/70 focus:border-success focus:ring-2 focus:ring-success/20',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  },
);

export type InputProps = InputHTMLAttributes<HTMLInputElement> &
  VariantProps<typeof inputVariants>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, state, lang, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-state={state}
      lang={lang ?? (type === 'date' ? 'en-GB' : undefined)}
      className={cn(inputVariants({ state }), 'px-3 py-2', className)}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
