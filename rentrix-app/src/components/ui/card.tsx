import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const cardVariants = cva(
  'rounded-xl text-card-foreground transition-[border-color,background-color] duration-150 motion-reduce:transition-none',
  {
    variants: {
      variant: {
        default: 'border border-border bg-card shadow-none',
        muted: 'border border-border bg-muted/40 shadow-none',
        outlined: 'border border-border bg-transparent shadow-none',
        elevated: 'border border-border bg-card shadow-elevated',
        interactive:
          'border border-border bg-card shadow-none transition-colors hover:border-primary/40 focus-within:border-primary/40 cursor-pointer',
        compact: 'border border-border bg-card p-0 shadow-none [&_[data-card-header]]:p-3 [&_[data-card-content]]:px-3 [&_[data-card-footer]]:px-3',
        statistic: 'border border-border bg-card p-4 shadow-none',
        financial: 'border border-border bg-card p-4 shadow-none',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type CardVariant = NonNullable<VariantProps<typeof cardVariants>['variant']>;

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
  return <div data-card-header className={cn('space-y-1 p-3.5 sm:p-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[15px] font-bold leading-6 sm:text-[16px]', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[14px] leading-6 text-muted-foreground sm:text-[14px]', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-card-content className={cn('px-3.5 pb-3.5 sm:px-4 sm:pb-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-card-footer
      className={cn('flex items-center gap-2 px-3.5 pb-3.5 sm:px-4 sm:pb-4', className)}
      {...props}
    />
  );
}
