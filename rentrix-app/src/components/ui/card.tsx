import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const cardVariants = cva(
  'rounded-xl text-card-foreground transition-shadow duration-200 motion-reduce:transition-none',
  {
    variants: {
      variant: {
        default: 'border border-border/70 bg-card shadow-card',
        muted: 'border border-border/50 bg-muted/30 shadow-none',
        outlined: 'border-2 border-border bg-transparent shadow-none',
        elevated: 'border border-border bg-card shadow-elevated',
        interactive:
          'border border-border/70 bg-card shadow-card transition-colors hover:border-primary/40 hover:shadow-card-hover focus-within:border-primary/40 focus-within:shadow-card-hover cursor-pointer',
        compact: 'border border-border/70 bg-card p-0 shadow-card [&_[data-card-header]]:p-3 [&_[data-card-content]]:px-3 [&_[data-card-footer]]:px-3',
        statistic:
          'border border-border/70 bg-card p-5 shadow-card',
        financial:
          'border border-border/70 bg-card shadow-card',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type CardVariant = NonNullable<VariantProps<typeof cardVariants>['variant']>;

/**
 * AppCard — the single card surface for the entire application.
 *
 * Cards rest on the page with a single subtle shadow. No hover scale
 * transforms in operational UI — this is a tool, not a marketing page.
 */
export function Card({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div
      data-component-card
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-card-header className={cn('space-y-1 p-4 sm:p-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold leading-6', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[0.8125rem] leading-5 text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-card-content className={cn('px-4 pb-4 sm:px-5 sm:pb-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-card-footer
      className={cn('flex items-center gap-2 px-4 pb-4 sm:px-5 sm:pb-5', className)}
      {...props}
    />
  );
}
