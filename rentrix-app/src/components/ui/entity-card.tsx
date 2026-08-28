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
        'relative w-full min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card p-3 text-start shadow-sm transition-[border-color,box-shadow] sm:p-3.5',
        clickable &&
          'cursor-pointer hover:border-primary/25 hover:shadow-card-focus visible:focus-visible:ring-2 focus-visible:ring-primary/15',
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
        <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
          <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl shadow-sm sm:size-10', tone.bg)}>
            <AvatarIcon className={cn('size-4 sm:size-4.5', tone.text)} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="line-clamp-2 break-words text-sm font-bold leading-5 [overflow-wrap:anywhere] sm:text-[15px] sm:leading-6">{name}</div>
            {subtitle ? (
              <div className="mt-0.5 line-clamp-2 break-words text-xs font-medium leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                {subtitle}
              </div>
            ) : null}
            {supportingText ? (
              <div className="mt-1 break-words text-xs font-semibold leading-5 text-muted-foreground [overflow-wrap:anywhere]">{supportingText}</div>
            ) : null}
          </div>
        </div>
        {badge ?? (
          <span className={cn('inline-flex min-h-6 shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold', tone.bg, tone.text)}>
            {tone.label}
          </span>
        )}
      </div>

      {stats ? (
        <div className="mt-2 border-t border-border/55 pt-2 text-xs text-foreground/80">
          {stats}
        </div>
      ) : null}

      {meta?.length ? (
        <div className="mt-2 grid gap-1.5 border-t border-border/55 pt-2 text-xs text-muted-foreground">
          {meta.map((item, index) => {
            const MetaIcon = item.icon;
            return (
              <div key={index} className={cn('flex items-center gap-1.5', item.className)}>
                {MetaIcon ? <MetaIcon className="size-3 shrink-0 text-muted-foreground/70" aria-hidden="true" /> : null}
                {item.label ? <span className="font-bold text-foreground/80">{item.label}</span> : null}
                <span dir={item.dir} className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-muted-foreground/80">
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
            'mt-2 grid gap-1.5 border-t border-border/55 pt-2',
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
                  'inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15',
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
