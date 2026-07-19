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
    label: 'مالك',
    bg: 'bg-[hsl(var(--color-success-bg))]',
    text: 'text-[hsl(var(--color-success-text))]',
    icon: Briefcase,
  },
  contact: {
    label: 'جهة اتصال',
    bg: 'bg-[hsl(var(--color-neutral-bg))]',
    text: 'text-[hsl(var(--color-neutral-text))]',
    icon: Contact,
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
  if (variant === 'danger') return 'border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15';
  if (variant === 'default') return 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15';
  return 'border-border/70 bg-background text-foreground/80 hover:bg-muted/70 hover:text-foreground';
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
        'relative w-full min-w-0 overflow-hidden rounded-[1.2rem] border border-border/70 bg-card p-3 text-start shadow-[0_5px_18px_hsl(var(--foreground)/0.04)] transition-[transform,border-color,box-shadow] sm:rounded-3xl sm:p-4',
        clickable &&
          'cursor-pointer hover:border-primary/25 hover:shadow-[0_12px_28px_hsl(var(--foreground)/0.07)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15',
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
      <div className="flex min-w-0 items-start justify-between gap-2.5 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
          <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl shadow-sm sm:size-10 sm:rounded-2xl', tone.bg)}>
            <AvatarIcon className={cn('size-4 sm:size-4.5', tone.text)} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold leading-5 sm:leading-6">{name}</p>
            {subtitle ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-4.5 text-muted-foreground sm:leading-5">
                {subtitle}
              </p>
            ) : null}
            {supportingText ? (
              <p className="mt-0.5 text-[10px] font-bold leading-4 text-muted-foreground/75 sm:mt-1">{supportingText}</p>
            ) : null}
          </div>
        </div>
        {badge ?? (
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold sm:px-2.5 sm:py-1 sm:text-[11px]', tone.bg, tone.text)}>
            {tone.label}
          </span>
        )}
      </div>

      {stats ? (
        <div className="mt-2.5 rounded-2xl border border-primary/10 bg-primary/[0.045] p-2.5 text-xs text-foreground/80 sm:mt-3 sm:p-3">
          {stats}
        </div>
      ) : null}

      {meta?.length ? (
        <div className="mt-2.5 grid gap-1.5 rounded-2xl bg-muted/35 p-2.5 text-xs text-muted-foreground sm:mt-3 sm:gap-2 sm:p-3">
          {meta.map((item, index) => {
            const MetaIcon = item.icon;
            return (
              <div key={index} className={cn('flex min-w-0 items-center gap-2', item.className)}>
                {MetaIcon ? <MetaIcon className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden="true" /> : null}
                {item.label ? <span className="shrink-0 font-bold text-foreground/80">{item.label}</span> : null}
                <span dir={item.dir} className="min-w-0 flex-1 truncate">
                  {item.value}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {actions?.length ? (
        <div
          className={cn(
            'mt-3 grid gap-1.5 border-t border-border/60 pt-2.5 sm:mt-4 sm:gap-2 sm:pt-3',
            actions.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          )}
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
                  'inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 sm:gap-2 sm:px-3 sm:text-xs',
                  getActionClassName(action.variant),
                )}
                onClick={action.onClick}
              >
                {ActionIcon ? <ActionIcon className="size-3.5 shrink-0 sm:size-4" aria-hidden="true" /> : null}
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
