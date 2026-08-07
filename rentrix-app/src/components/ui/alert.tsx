import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, type LucideIcon } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const alertVariants = cva(
  [
    'relative flex w-full items-start gap-3 rounded-xl border p-4 text-sm',
    'transition-colors motion-reduce:transition-none',
  ].join(' '),
  {
    variants: {
      variant: {
        info: 'border-info/30 bg-info-bg text-foreground [&_[data-alert-icon]]:text-info',
        success: 'border-success/30 bg-success-bg text-foreground [&_[data-alert-icon]]:text-success',
        warning: 'border-warning/30 bg-warning-bg text-foreground [&_[data-alert-icon]]:text-warning',
        danger: 'border-danger/30 bg-danger-bg text-foreground [&_[data-alert-icon]]:text-danger',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

const variantIcons: Record<NonNullable<VariantProps<typeof alertVariants>['variant']>, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
};

type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    title?: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon | null;
    action?: ReactNode;
  };

/** Inline alert banner — informational/validation feedback (not a dialog/toast). */
export function Alert({
  variant = 'info',
  title,
  description,
  icon,
  action,
  className,
  children,
  role,
  ...props
}: AlertProps) {
  const Icon = icon === null ? null : (icon ?? variantIcons[variant ?? 'info']);
  const resolvedRole = role ?? (variant === 'danger' ? 'alert' : 'status');

  return (
    <div role={resolvedRole} className={cn(alertVariants({ variant }), className)} {...props}>
      {Icon ? (
        <Icon data-alert-icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-bold leading-6">{title}</p> : null}
        {description ? <div className="text-[0.8125rem] leading-6 text-foreground/80">{description}</div> : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mb-1 font-bold leading-6', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-[0.8125rem] leading-6 text-foreground/80', className)} {...props} />;
}
