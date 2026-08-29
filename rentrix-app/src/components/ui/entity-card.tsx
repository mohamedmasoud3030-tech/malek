import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  Building2,
  Contact,
  DoorOpen,
  FileText,
  Mail,
  MapPinned,
  Phone,
  ReceiptText,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import type { ReactNode } from 'react';
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
  /** Compatibility metadata for non-card identity badges. EntityCard ignores it. */
  bg: string;
  text: string;
}>;

/**
 * Entity identity changes the semantic icon/label only inside EntityCard.
 * The bg/text metadata remains available to existing table badges, but card
 * geometry, surface, spacing, borders and actions are identical for all types.
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
  supportingText?: ReactNode;
  type?: EntityCardType;
  badge?: ReactNode;
  meta?: EntityCardMetaItem[];
  stats?: ReactNode;
  actions?: EntityCardAction[];
  onClick?: () => void;
  className?: string;
  avatarIcon?: LucideIcon;
}

function getActionClassName(variant: EntityCardAction['variant'] = 'secondary') {
  if (variant === 'danger') return 'border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10';
  if (variant === 'default') return 'border-primary/25 bg-primary/8 text-primary hover:bg-primary/12';
  return 'border-border/65 bg-background text-foreground/85 hover:bg-muted/45 hover:text-foreground';
}

/**
 * Card shell.
 *
 * The whole card used to carry `role="button"` while still containing the
 * per-record action buttons, which is a `nested-interactive` failure (WCAG
 * 4.1.2): a screen reader reaches one composite "button" whose own name is the
 * entire card text, and the nested actions become unreachable in some
 * AT browse modes.
 *
 * The clickable region is now a real `<button>` covering the record body only,
 * rendered as a sibling of the action row — the same structure `MobileCard`
 * already uses. The `<article>` stays a plain container, so the card keeps one
 * predictable primary activation plus independently reachable actions.
 */
function EntityCardShell({ id, clickable, className, children }: Readonly<{
  id: string;
  clickable: boolean;
  className?: string;
  children: ReactNode;
}>) {
  return (
    <article
      data-entity-card
      data-entity-id={id}
      className={cn(
        'relative w-full min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card p-2 text-start shadow-none transition-[border-color,background-color]',
        // The hover affordance stays on the card while activation lives on the
        // inner button, so the visual behaviour is unchanged.
        clickable && 'has-[[data-entity-card-primary]:hover]:border-primary/30',
        className,
      )}
    >
      {children}
    </article>
  );
}

export function EntityCard({
  id, name, subtitle, supportingText, type = 'record', badge, meta, stats, actions, onClick, className, avatarIcon,
}: EntityCardProps) {
  const identity = entityCardTypeMap[type] ?? entityCardTypeMap.record!;
  const AvatarIcon = avatarIcon ?? identity.icon;

  const body = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-md border border-border/55 bg-muted/45 text-foreground/70">
            <AvatarIcon className="size-3.5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="line-clamp-2 break-words text-[13px] font-bold leading-[18px] text-foreground [overflow-wrap:anywhere]">{name}</div>
            {subtitle ? (
              <div className="mt-0.5 line-clamp-2 break-words text-[11.5px] font-medium leading-4 text-muted-foreground [overflow-wrap:anywhere]">{subtitle}</div>
            ) : null}
            {supportingText ? (
              <div className="mt-0.5 break-words text-[11.5px] font-medium leading-4 text-muted-foreground [overflow-wrap:anywhere]">{supportingText}</div>
            ) : null}
          </div>
        </div>
        {badge ?? (
          <span className="inline-flex min-h-5 shrink-0 items-center rounded border border-border/60 bg-muted/45 px-1.5 py-0 text-[10.5px] font-bold leading-4 text-muted-foreground">
            {identity.label}
          </span>
        )}
      </div>

      {stats ? <div className="mt-1.5 border-t border-border/55 pt-1.5 text-[11.5px] leading-4 text-foreground/85">{stats}</div> : null}

      {meta?.length ? (
        <div className="mt-1.5 grid gap-1 border-t border-border/55 pt-1.5 text-[11.5px] leading-4 text-muted-foreground">
          {meta.map((item, index) => {
            const MetaIcon = item.icon;
            return (
              <div key={index} className={cn('flex min-w-0 items-center gap-1', item.className)}>
                {MetaIcon ? <MetaIcon className="size-3 shrink-0 text-muted-foreground/70" aria-hidden="true" /> : null}
                {item.label ? <span className="shrink-0 font-bold text-foreground/78">{item.label}</span> : null}
                <span dir={item.dir} className="min-w-0 flex-1 break-words font-medium [overflow-wrap:anywhere]">{item.value}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );

  return (
    <EntityCardShell id={id} clickable={Boolean(onClick)} className={className}>
      {onClick ? (
        <button
          type="button"
          data-entity-card-primary
          onClick={onClick}
          className={cn(
            'block w-full min-w-0 cursor-pointer rounded-md text-start outline-none',
            'transition-colors hover:bg-muted/10 focus-visible:ring-2 focus-visible:ring-primary/20',
          )}
        >
          {body}
        </button>
      ) : (
        body
      )}

      {actions?.length ? (
        <div
          /*
           * Keeps the incoming layout fix (a lone trailing action spans both
           * columns). The stopPropagation handlers that used to sit here are
           * deliberately gone: the card is no longer an ancestor button, so
           * action clicks never reach a parent handler and suppressing
           * bubbling would only break normal event flow.
           */
          className={cn(
            'mt-1.5 grid gap-1 border-t border-border/55 pt-1.5',
            actions.length === 1 ? 'grid-cols-1' : 'grid-cols-2 [&>:last-child:nth-child(odd)]:col-span-2',
          )}
        >
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={index}
                type="button"
                aria-label={action.ariaLabel}
                className={cn(
                  'inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded border px-2 text-[11.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
                  getActionClassName(action.variant),
                )}
                onClick={action.onClick}
              >
                {ActionIcon ? <ActionIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </EntityCardShell>
  );
}

export const entityCardContactMeta = {
  phone: (value: ReactNode): EntityCardMetaItem => ({ icon: Phone, value, dir: 'ltr' }),
  email: (value: ReactNode): EntityCardMetaItem => ({ icon: Mail, value, dir: 'ltr' }),
};
