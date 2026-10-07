import { ArrowUpLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EntityCellProps = Readonly<{
  icon?: React.ComponentType<{ className?: string }>;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional small caption rendered under the subtitle, e.g. a record id. */
  meta?: ReactNode;
  tone?: 'primary' | 'emerald' | 'slate';
}>;

const toneStyles: Record<NonNullable<EntityCellProps['tone']>, string> = {
  primary: 'bg-primary/10 text-primary',
  emerald: 'bg-success-bg text-success',
  slate: 'bg-neutral-bg text-neutral',
};

/**
 * Avatar-led "who/what is this row" cell used as the leading column in
 * every entity table (owners, people/tenants, units, properties,
 * contracts). Mirrors the icon-box header already used in the matching
 * mobile card components (EntityCard, UnitCard, PropertyCard,
 * ContractCard) so a record looks the same whether the screen renders it
 * as a card (mobile) or a table row (desktop).
 */
export function EntityCell({ icon: Icon, title, subtitle, meta, tone = 'primary' }: EntityCellProps) {  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {Icon ? (
        <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl', toneStyles[tone])}>
          <Icon className="size-4" />
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="font-semibold text-sm leading-snug truncate">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p> : null}
        {meta ? <p className="mt-0.5 text-xs font-bold leading-5 text-muted-foreground">{meta}</p> : null}
      </div>
    </div>
  );
}

type EntityLinkProps = Readonly<{
  href: string;
  children: ReactNode;
  className?: string;
}>;

/**
 * Canonical inline record link — "open the record this figure belongs to".
 *
 * Report panels, dossier summaries and table cells all need the same quiet
 * affordance: primary-coloured bold text with the RTL forward arrow. Feature
 * copies (`SafeAnchor`, per-register link spans) are prohibited; this is the
 * one place the treatment lives.
 *
 * It renders a plain anchor so it also works for external/printable output.
 * For in-app navigation prefer `<Link>` from the router with the same classes.
 */
export function EntityLink({ href, children, className }: EntityLinkProps) {
  return (
    <a
      href={href}
      data-entity-link
      className={cn(
        'inline-flex items-center gap-1 font-bold text-primary hover:underline',
        className,
      )}
    >
      {children}
      <ArrowUpLeft className="size-3 shrink-0" aria-hidden="true" />
    </a>
  );
}
