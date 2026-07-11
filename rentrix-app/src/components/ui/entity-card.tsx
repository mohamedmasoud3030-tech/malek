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
  event.preventDefault();
  onClick();
}

function EntityCardShell({ id, clickable, onClick, className, children }: Readonly<{ id: string; clickable: boolean; onClick?: () => void; className?: string; children: ReactNode }>) {
  return (
    <article
      data-entity-id={id}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => handleCardKeyDown(event, onClick)}
      className={cn(
        'w-full rounded-2xl border border-border/60 bg-card p-4 text-start transition-all duration-150',
        clickable && 'cursor-pointer hover:border-primary/30 hover:shadow-md active:scale-[0.98]',
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
  const tone = entityCardTypeMap[type] ?? entityCardTypeMap['contact']!;
  const AvatarIcon = avatarIcon ?? tone.icon ?? Users;

  return (
    <EntityCardShell id={id} clickable={Boolean(onClick)} onClick={onClick} className={className}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl', tone.bg)}>
            <AvatarIcon className={cn('size-4', tone.text)} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-snug">{name}</p>
            {subtitle ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p> : null}
            {supportingText ? <p className="mt-0.5 text-[10px] font-bold text-muted-foreground/70">{supportingText}</p> : null}
          </div>
        </div>
        {badge ?? (
          <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold', tone.bg, tone.text)}>
            {tone.label}
          </span>
        )}
      </div>

      {meta?.length ? (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-border/40 pt-3 text-xs text-muted-foreground">
          {meta.map((item, index) => {
            const MetaIcon = item.icon;
            return (
              <div key={index} className={cn('flex items-center gap-1.5', item.className)}>
                {MetaIcon ? <MetaIcon className="size-3.5 shrink-0" /> : null}
                {item.label ? <span className="font-bold text-foreground/80">{item.label}</span> : null}
                <span dir={item.dir} className="truncate">{item.value}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {stats ? <div className="mt-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">{stats}</div> : null}

      {actions?.length ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={index}
                type="button"
                aria-label={action.ariaLabel}
                className={cn('inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors', getActionClassName(action.variant))}
                onClick={action.onClick}
              >
                {ActionIcon ? <ActionIcon className="size-3.5" /> : null}
                {action.label}
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
