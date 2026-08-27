import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const cardVariants = cva(
  'rounded-xl text-card-foreground transition-shadow duration-200 motion-reduce:transition-none',
  {
    variants: {
      variant: {
        default: 'border border-border/65 bg-card shadow-card',
        muted: 'border border-border/50 bg-muted/30 shadow-none',
        outlined: 'border-2 border-border bg-transparent shadow-none',
        elevated: 'border border-border bg-card shadow-elevated',
        interactive:
          'border border-border/70 bg-card shadow-card transition-colors hover:border-primary/40 hover:shadow-card-hover focus-within:border-primary/40 focus-within:shadow-card-hover cursor-pointer',
        compact: 'border border-border/70 bg-card p-0 shadow-card [&_[data-card-header]]:p-2 [&_[data-card-content]]:px-2 [&_[data-card-footer]]:px-2',
        statistic:
          'border border-border/70 bg-card p-4 shadow-card',
        financial: 'border border-border/80 bg-card p-4 shadow-card ring-1 ring-primary/5',
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

/**
 * Card header. Padding matches CardContent's box (12px on phone, 16px from
 * `sm`) so a card title sits on the same left/right edge as the body copy
 * beneath it, with equal breathing room above the title and below the body.
 * The `compact` variant overrides this through the [data-card-header] hook.
 */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-card-header className={cn('space-y-0.5 p-3 sm:p-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold leading-6', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-card-content className={cn('px-3 pb-3 sm:px-4 sm:pb-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-card-footer
      className={cn('flex items-center gap-2 px-3 pb-3 sm:px-4 sm:pb-4', className)}
      {...props}
    />
  );
}
