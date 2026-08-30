import type { LucideIcon } from 'lucide-react';
import { Briefcase, Building2, Contact, DoorOpen, FileText, MapPinned, ReceiptText, User, Users, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EntityCardType =
  | 'record'
  | 'tenant'
  | 'owner'
  | 'contact'
  | 'property'
  | 'unit'
  | 'contract'
  | 'maintenance'
  | 'land'
  | 'service-provider'
  | 'invoice'
  | string;

export type EntityCardMetaItem = Readonly<{
  icon?: LucideIcon;
  label?: ReactNode;
  value: ReactNode;
  dir?: 'ltr' | 'rtl' | 'auto';
  className?: string;
}>;

export type EntityCardAction = Readonly<{
  label: ReactNode;
  icon?: LucideIcon;
  variant?: 'default' | 'secondary' | 'danger';
  onClick: () => void;
  ariaLabel?: string;
}>;

type EntityCardIdentity = Readonly<{
  label: string;
  icon: LucideIcon;
  /** Compatibility metadata for non-card identity badges. */
  bg: string;
  text: string;
}>;

/**
 * Entity identity now drives only the fallback chip label. Mobile register rows
 * intentionally stay visually quiet: one neutral shell, optional status badge,
 * strong title, secondary metadata, and compact actions.
 */
export const entityCardTypeMap: Record<string, EntityCardIdentity> = {
  record: { label: 'سجل', icon: Users, bg: 'bg-muted/45', text: 'text-muted-foreground' },
  tenant: { label: 'مستأجر', icon: User, bg: 'bg-primary/10', text: 'text-primary' },
  owner: { label: 'مالك', icon: Briefcase, bg: 'bg-[hsl(var(--color-success-bg))]', text: 'text-[hsl(var(--color-success-text))]' },
  contact: { label: 'جهة اتصال', icon: Contact, bg: 'bg-[hsl(var(--color-neutral-bg))]', text: 'text-[hsl(var(--color-neutral-text))]' },
  property: { label: 'عقار', icon: Building2, bg: 'bg-primary/10', text: 'text-primary' },
  unit: { label: 'وحدة', icon: DoorOpen, bg: 'bg-primary/10', text: 'text-primary' },
  contract: { label: 'عقد', icon: FileText, bg: 'bg-primary/10', text: 'text-primary' },
  maintenance: { label: 'صيانة', icon: Wrench, bg: 'bg-[hsl(var(--color-warning-bg))]', text: 'text-[hsl(var(--color-warning-text))]' },
  land: { label: 'أرض', icon: MapPinned, bg: 'bg-primary/10', text: 'text-primary' },
  'service-provider': { label: 'مزود خدمة', icon: Wrench, bg: 'bg-primary/10', text: 'text-primary' },
  invoice: { label: 'فاتورة', icon: ReceiptText, bg: 'bg-primary/10', text: 'text-primary' },
};

export interface EntityCardProps {
  id: string;
  name: ReactNode;
  subtitle?: ReactNode;
  type?: EntityCardType;
  badge?: ReactNode;
  primaryMeta?: EntityCardMetaItem[];
  secondaryMeta?: EntityCardMetaItem[];
  primaryAction?: EntityCardAction;
  secondaryAction?: EntityCardAction;
  overflowActions?: EntityCardAction[];
  onClick?: () => void;
  className?: string;
  bodyAriaLabel?: string;
}

function getActionClassName(variant: EntityCardAction['variant'] = 'secondary') {
  if (variant === 'danger') return 'border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10';
  if (variant === 'default') return 'border-primary/15 bg-primary text-primary-foreground hover:bg-primary/92';
  return 'border-border/70 bg-background text-foreground/88 hover:bg-muted/35 hover:text-foreground';
}

function actionLabelText(label: ReactNode) {
  if (label == null || typeof label === 'boolean') return '';
  if (typeof label === 'string' || typeof label === 'number') return String(label);
  return 'إجراء';
}

function ActionButton({ action, className }: Readonly<{ action: EntityCardAction; className?: string }>) {
  const ActionIcon = action.icon;
  return (
    <Button
      type="button"
      size="sm"
      aria-label={action.ariaLabel}
      className={cn(
        'min-w-0 gap-1.5 rounded-xl border px-3 text-[11.5px] font-semibold shadow-none',
        getActionClassName(action.variant),
        className,
      )}
      onClick={action.onClick}
    >
      {ActionIcon ? <ActionIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{action.label}</span>
    </Button>
  );
}

function EntityCardShell({ id, className, children }: Readonly<{
  id: string;
  className?: string;
  children: ReactNode;
}>) {
  return (
    <article
      data-entity-card
      data-entity-id={id}
      className={cn(
        'relative w-full min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card px-4 py-3 text-start shadow-none',
        '[&_[data-status-badge]]:min-h-5 [&_[data-status-badge]]:gap-1 [&_[data-status-badge]]:px-1.5 [&_[data-status-badge]]:py-0 [&_[data-status-badge]]:text-[10.5px] [&_[data-status-badge]]:leading-4',
        className,
      )}
    >
      {children}
    </article>
  );
}

function MetaGrid({ items, primary = false }: Readonly<{ items: EntityCardMetaItem[]; primary?: boolean }>) {
  const columnClass = items.length <= 1 ? 'grid-cols-1' : items.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
  return (
    <dl
      data-entity-table-mobile-summary={primary ? '' : undefined}
      data-entity-table-mobile-secondary-meta={primary ? undefined : ''}
      className={cn(
        primary
          ? cn('mt-3 grid gap-2 border-t border-border/55 pt-3', columnClass)
          : 'mt-2 grid gap-1.5 text-[12px] leading-4.5 text-muted-foreground',
      )}
    >
      {items.map((item, index) => {
        const MetaIcon = item.icon;
        return (
          <div key={index} className={cn('min-w-0', item.className)}>
            {item.label ? (
              <dt className={cn(primary ? 'truncate text-[10px] font-bold leading-3.5 text-muted-foreground' : 'text-[10.5px] font-semibold text-muted-foreground/90')}>
                {item.label}
              </dt>
            ) : null}
            <dd
              dir={item.dir}
              className={cn(
                'min-w-0 [overflow-wrap:anywhere]',
                primary
                  ? 'mt-0.5 line-clamp-2 text-[12.5px] font-semibold leading-4.5 text-foreground'
                  : item.label
                    ? 'mt-0.5 text-[12px] font-medium leading-4.5 text-foreground/88'
                    : 'text-[12px] font-medium leading-4.5 text-muted-foreground',
              )}
            >
              <span className="inline-flex min-w-0 items-start gap-1.5">
                {MetaIcon ? <MetaIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground/70" aria-hidden="true" /> : null}
                <span className="min-w-0 flex-1">{item.value}</span>
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function EntityCard({
  id,
  name,
  subtitle,
  type = 'record',
  badge,
  primaryMeta,
  secondaryMeta,
  primaryAction,
  secondaryAction,
  overflowActions,
  onClick,
  className,
  bodyAriaLabel,
}: EntityCardProps) {
  const identity = entityCardTypeMap[type] ?? entityCardTypeMap.record!;
  const hasActions = Boolean(primaryAction || secondaryAction || overflowActions?.length);

  const body = (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 break-words text-[15px] font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
            {name}
          </div>
          {subtitle ? (
            <div className="mt-1 line-clamp-2 break-words text-[12.5px] font-medium leading-4.5 text-foreground/86 [overflow-wrap:anywhere]">
              {subtitle}
            </div>
          ) : null}
        </div>
        {badge ?? (
          <span className="inline-flex min-h-5 shrink-0 items-center rounded-full border border-border/60 bg-muted/35 px-1.5 py-0 text-[10.5px] font-semibold leading-4 text-muted-foreground">
            {identity.label}
          </span>
        )}
      </div>

      {primaryMeta?.length ? <MetaGrid items={primaryMeta} primary /> : null}
      {secondaryMeta?.length ? <MetaGrid items={secondaryMeta} /> : null}
    </div>
  );

  return (
    <EntityCardShell id={id} className={className}>
      {onClick ? (
        <button
          type="button"
          data-entity-card-primary
          aria-label={bodyAriaLabel}
          onClick={onClick}
          className={cn(
            'block w-full min-w-0 rounded-xl text-start outline-none transition-colors hover:bg-muted/8',
            'focus-visible:ring-2 focus-visible:ring-primary/20',
          )}
        >
          {body}
        </button>
      ) : (
        body
      )}

      {hasActions ? (
        <div className="mt-3 flex items-center gap-2 border-t border-border/55 pt-3" role="presentation">
          {primaryAction ? <ActionButton action={primaryAction} className="min-w-0 flex-1" /> : null}
          {secondaryAction ? <ActionButton action={secondaryAction} className={primaryAction ? 'shrink-0' : 'min-w-0 flex-1'} /> : null}
          {overflowActions?.length ? (
            <ActionMenu
              label={`المزيد حول ${actionLabelText(name) || identity.label}`}
              className="shrink-0"
              items={overflowActions.map((action, index) => ({
                id: `${id}-overflow-${index}`,
                label: actionLabelText(action.label),
                icon: action.icon,
                danger: action.variant === 'danger',
                onClick: action.onClick,
              }))}
            />
          ) : null}
        </div>
      ) : null}
    </EntityCardShell>
  );
}
