import {
  Archive,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileX2,
  PauseCircle,
  type LucideIcon,
  Wallet,
} from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

/**
 * Visual-only business states. These carry an icon in addition to color so
 * meaning is never communicated by color alone (accessibility). They map to
 * semantic tokens and contain no business logic — pages map their own domain
 * enums to these presets.
 */
export type BadgeStatus =
  | 'active'
  | 'inactive'
  | 'draft'
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'archived'
  | 'void';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground ring-border',
  primary: 'bg-primary/10 text-primary ring-primary/20',
  neutral: 'bg-neutral-bg text-neutral ring-neutral/20',
  success: 'bg-success-bg text-success ring-success/20',
  warning: 'bg-warning-bg text-warning ring-warning/20',
  danger: 'bg-danger-bg text-danger ring-danger/20',
  info: 'bg-info-bg text-info ring-info/20',
  outline: 'bg-transparent text-foreground ring-border',
};

export const statusPresets: Record<
  BadgeStatus,
  { variant: BadgeVariant; Icon: LucideIcon; label: string }
> = {
  active: { variant: 'success', Icon: CheckCircle2, label: 'نشط' },
  inactive: { variant: 'neutral', Icon: PauseCircle, label: 'غير نشط' },
  draft: { variant: 'neutral', Icon: CircleDashed, label: 'مسودة' },
  pending: { variant: 'warning', Icon: Clock, label: 'قيد الانتظار' },
  paid: { variant: 'success', Icon: Wallet, label: 'مدفوع' },
  overdue: { variant: 'danger', Icon: Clock, label: 'متأخر' },
  cancelled: { variant: 'danger', Icon: Ban, label: 'ملغى' },
  archived: { variant: 'neutral', Icon: Archive, label: 'مؤرشف' },
  void: { variant: 'outline', Icon: FileX2, label: 'باطل' },
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
};

/**
 * Compact label pill for counts, tags, and lightweight status markers.
 * For domain status mapping prefer <Badge status="paid" /> or StatusBadge.
 */
export function Badge({ variant = 'default', className, children, dot = false, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset',
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

type StatusBadgePillProps = Omit<BadgeProps, 'variant' | 'children' | 'dot'> & {
  status: BadgeStatus;
  /** Override the preset Arabic label. */
  label?: ReactNode;
  /** Hide the leading status icon (label still remains). */
  hideIcon?: boolean;
};

/** Visual preset for common lifecycle/payment states. No business logic. */
export function StatusBadgePill({ status, label, hideIcon = false, className, ...props }: StatusBadgePillProps) {
  const preset = statusPresets[status];
  const Icon = preset.Icon;
  return (
    <Badge variant={preset.variant} className={className} {...props}>
      {hideIcon ? null : <Icon className="size-3" aria-hidden="true" />}
      {label ?? preset.label}
    </Badge>
  );
}
