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
  owner: { label: 'مالك', bg: 'bg-emerald-100 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-300', icon: Briefcase },
  contact: { label: 'جهة اتصال', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', icon: Contact },
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
  if (variant === 'danger') return 'border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15';
  if (variant === 'default') return 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15';
  return 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80';
}

function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, onClick?: () => void) {
  if (!onClick) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
  event.preventDefault();
  onClick();
}

function EntityCardShell({
  id,
  clickable,
  onClick,
  className,
  children,
}: Readonly<{
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
        'relative w-full min-w-0 overflow-hidden rounded-[1.35rem] border border-border/70 bg-card p-4 text-start shadow-[0_8px_24px_hsl(var(--foreground)/0.045)] transition-[transform,border-color,box-shadow] sm:rounded-3xl',
        clickable && 'cursor-pointer hover:border-primary/25 hover:shadow-[0_14px_32px_hsl(var(--foreground)/0.075)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15',
        className,
      )}
    >
      {children}
    </article>
  );
}

export function EntityCard({
  id,
  name,
  subtitle,
  supportingText,
  type = 'contact',
  badge,
  meta,
  stats,
  actions,
  onClick,
  className,
  avatarIcon,
}: EntityCardProps) {
  const tone = entityCardTypeMap[type] ?? entityCardTypeMap.contact!;
  const AvatarIcon = avatarIcon ?? tone.icon ?? Users;

  return (
    <EntityCardShell id={id} clickable={Boolean(onClick)} onClick={onClick} className={className}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className={cn('grid size-10 shrink-0 place-items-center rounded-2xl shadow-sm', tone.bg)}>
            <AvatarIcon className={cn('size-4.5', tone.text)} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-black leading-6">{name}</p>
            {subtitle ? <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-5 text-muted-foreground">{subtitle}</p> : null}
            {supportingText ? <p className="mt-1 text-[10px] font-bold leading-4 text-muted-foreground/75">{supportingText}</p> : null}
          </div>
        </div>
        {badge ?? (
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold', tone.bg, tone.text)}>
            {tone.label}
          </span>
        )}
      </div>

      {meta?.length ? (
        <div className="mt-3 grid gap-2 rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">
          {meta.map((item, index) => {
            const MetaIcon = item.icon;
            return (
              <div key={index} className={cn('flex min-w-0 items-center gap-2', item.className)}>
                {MetaIcon ? <MetaIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                {item.label ? <span className="shrink-0 font-bold text-foreground/80">{item.label}</span> : null}
                <span dir={item.dir} className="min-w-0 flex-1 truncate">{item.value}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {stats ? <div className="mt-3 rounded-2xl border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">{stats}</div> : null}

      {actions?.length ? (
        <div
          className="mt-4 grid grid-cols-1 gap-2 border-t border-border/60 pt-3 sm:grid-cols-2"
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
                  'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15',
                  getActionClassName(action.variant),
                )}
                onClick={action.onClick}
              >
                {ActionIcon ? <ActionIcon className="size-4 shrink-0" aria-hidden="true" /> : null}
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
