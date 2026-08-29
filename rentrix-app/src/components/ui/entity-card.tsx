import type { LucideIcon } from 'lucide-react';
import { Briefcase, Contact, Mail, Phone, User, Users } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EntityCardType = 'tenant' | 'owner' | 'contact' | string;

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

type EntityCardTone = Readonly<{
  label: string;
  bg: string;
  text: string;
  icon: LucideIcon;
}>;

export const entityCardTypeMap: Record<string, EntityCardTone> = {
  tenant: { label: 'مستأجر', bg: 'bg-primary/10', text: 'text-primary', icon: User },
  owner: {
    label: 'مالك', bg: 'bg-[hsl(var(--color-success-bg))]', text: 'text-[hsl(var(--color-success-text))]', icon: Briefcase,
  },
  contact: {
    label: 'جهة اتصال', bg: 'bg-[hsl(var(--color-neutral-bg))]', text: 'text-[hsl(var(--color-neutral-text))]', icon: Contact,
  },
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

function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, onClick?: () => void) {
  if (!onClick) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
  event.preventDefault();
  onClick();
}

function EntityCardShell({ id, clickable, onClick, className, children }: Readonly<{
  id: string;
  clickable: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}>) {
  return (
    <article
      data-entity-card
      data-entity-id={id}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => handleCardKeyDown(event, onClick)}
      className={cn(
        'relative w-full min-w-0 overflow-hidden rounded-lg border border-border/70 bg-card p-2 text-start shadow-none transition-[border-color,background-color] sm:p-2.5',
        clickable && 'cursor-pointer hover:border-primary/30 hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
        className,
      )}
    >
      {children}
    </article>
  );
}

export function EntityCard({
  id, name, subtitle, supportingText, type = 'contact', badge, meta, stats, actions, onClick, className, avatarIcon,
}: EntityCardProps) {
  const tone = entityCardTypeMap[type] ?? entityCardTypeMap.contact!;
  const AvatarIcon = avatarIcon ?? tone.icon ?? Users;

  return (
    <EntityCardShell id={id} clickable={Boolean(onClick)} onClick={onClick} className={className}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className={cn('grid size-8 shrink-0 place-items-center rounded-md border border-border/45', tone.bg)}>
            <AvatarIcon className={cn('size-3.5', tone.text)} aria-hidden="true" />
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
          <span className={cn('inline-flex min-h-5 shrink-0 items-center rounded border border-current/10 px-1.5 py-0 text-[10.5px] font-bold leading-4', tone.bg, tone.text)}>
            {tone.label}
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

      {actions?.length ? (
        <div
          className={cn('mt-1.5 grid gap-1 border-t border-border/55 pt-1.5', actions.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={index}
                type="button"
                aria-label={action.ariaLabel}
                className={cn(
                  'inline-flex min-h-9 min-w-0 items-center justify-center gap-1 rounded border px-2 text-[11.5px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
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
