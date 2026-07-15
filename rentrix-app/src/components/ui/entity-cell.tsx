import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EntityCellProps = Readonly<{
  icon: React.ComponentType<{ className?: string }>;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional small caption rendered under the subtitle, e.g. a record id. */
  meta?: ReactNode;
  tone?: 'primary' | 'emerald' | 'slate';
}>;

const toneStyles: Record<NonNullable<EntityCellProps['tone']>, string> = {
  primary: 'bg-primary/10 text-primary',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

/**
 * Avatar-led "who/what is this row" cell used as the leading column in
 * every entity table (owners, people/tenants, units, properties,
 * contracts). Mirrors the icon-box header already used in the matching
 * mobile card components (EntityCard, UnitCard, PropertyCard,
 * ContractCard) so a record looks the same whether the screen renders it
 * as a card (mobile) or a table row (desktop).
 */
export function EntityCell({ icon: Icon, title, subtitle, meta, tone = 'primary' }: EntityCellProps) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl', toneStyles[tone])}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm leading-snug truncate">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p> : null}
        {meta ? <p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">{meta}</p> : null}
      </div>
    </div>
  );
}
