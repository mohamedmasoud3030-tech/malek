import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type CardVariant = 'default' | 'muted' | 'outlined' | 'elevated';

const cardVariants: Record<CardVariant, string> = {
  default: 'border border-border/70 bg-card text-card-foreground shadow-card',
  muted: 'border border-border/50 bg-muted/30 text-card-foreground shadow-none',
  outlined: 'border-2 border-border bg-transparent text-card-foreground shadow-none',
  elevated: 'border border-border bg-card text-card-foreground shadow-elevated',
};

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
      className={cn('rounded-xl transition-shadow duration-200 motion-reduce:transition-none', cardVariants[variant], className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1 p-4 sm:p-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold leading-6', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[0.8125rem] leading-5 text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4 sm:px-5 sm:pb-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-2 px-4 pb-4 sm:px-5 sm:pb-5', className)} {...props} />
  );
}
