import { CloudOff, Inbox, LockKeyhole } from 'lucide-react';
import type { AriaAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './card';

type StateKind = 'empty' | 'offline' | 'permission' | 'error';
type StateTone = 'neutral' | 'warning' | 'danger';

type StateSurfaceProps = {
  kind: StateKind;
  tone: StateTone;
  icon: ReactNode;
  title: string;
  description: string;
  detail?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
  role?: 'status' | 'alert';
  ariaLive?: AriaAttributes['aria-live'];
};

type PublicStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

type EmptyStateProps = PublicStateProps & {
  role?: 'status' | 'alert';
  ariaLive?: AriaAttributes['aria-live'];
};

const cardTone: Record<StateTone, string> = {
  neutral: 'border-border/70 bg-card',
  warning: 'border-warning/20 bg-[hsl(var(--color-warning-bg)/0.12)]',
  danger: 'border-danger/25 bg-[hsl(var(--color-danger-bg)/0.1)]',
};

const iconTone: Record<StateTone, string> = {
  neutral: 'bg-muted/70 text-muted-foreground/70',
  warning: 'bg-warning-bg text-warning ring-1 ring-warning/10',
  danger: 'bg-danger-bg text-danger ring-1 ring-danger/10',
};

/**
 * Canonical non-loading state surface.
 * Empty, offline, permission and recoverable-error states share one visual
 * grammar; semantic wrappers below keep call sites explicit and accessible.
 */
export function StateSurface({
  kind,
  tone,
  icon,
  title,
  description,
  detail,
  action,
  className,
  compact = false,
  role = 'status',
  ariaLive,
}: StateSurfaceProps) {
  return (
    <Card
      data-state-surface
      data-state-kind={kind}
      data-empty-state={kind === 'empty' ? '' : undefined}
      data-offline-state={kind === 'offline' ? '' : undefined}
      data-no-permission-state={kind === 'permission' ? '' : undefined}
      data-error-state={kind === 'error' ? '' : undefined}
      role={role}
      aria-live={ariaLive}
      className={cn(
        'min-w-0 overflow-hidden shadow-none',
        cardTone[tone],
        kind === 'empty' && 'border-dashed',
        className,
      )}
    >
      <CardContent
        data-state-surface-content
        className={cn(
          'flex flex-col items-center justify-center text-center',
          compact ? 'min-h-0 gap-2 px-4 py-4' : 'min-h-28 gap-2.5 px-4 py-5',
        )}
      >
        <div
          data-state-surface-icon
          data-empty-state-icon={kind === 'empty' ? '' : undefined}
          className={cn('grid size-10 shrink-0 place-items-center rounded-lg', iconTone[tone])}
        >
          {icon}
        </div>

        <div className="min-w-0 max-w-full overflow-hidden">
          <h3 className="break-words text-base font-semibold [overflow-wrap:anywhere]">{title}</h3>
          <p className="mt-1 max-w-md break-words text-[0.8125rem] leading-6 text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        </div>

        {detail ? <div className="w-full max-w-md">{detail}</div> : null}
        {action ? <div className="min-w-0 max-w-full">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
  role = 'status',
  ariaLive = 'polite',
}: EmptyStateProps) {
  return (
    <StateSurface
      kind="empty"
      tone="neutral"
      icon={<Inbox className="size-5" aria-hidden="true" />}
      title={title}
      description={description}
      action={action}
      className={className}
      role={role}
      ariaLive={ariaLive}
    />
  );
}

/** Offline indicator surface. Presentational only — does not touch network state. */
export function OfflineState({ title, description, action, className }: PublicStateProps) {
  return (
    <StateSurface
      kind="offline"
      tone="warning"
      icon={<CloudOff className="size-5" aria-hidden="true" />}
      title={title}
      description={description}
      action={action}
      className={className}
      role="status"
      ariaLive="polite"
    />
  );
}

/** No-permission surface. Presentational only — enforcement stays in route guards. */
export function NoPermissionState({ title, description, action, className }: PublicStateProps) {
  return (
    <StateSurface
      kind="permission"
      tone="danger"
      icon={<LockKeyhole className="size-5" aria-hidden="true" />}
      title={title}
      description={description}
      action={action}
      className={className}
      role="status"
    />
  );
}
