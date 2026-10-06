import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A presentational choice tile for an already-existing small option set.
 * It owns no selection state or business meaning: callers keep values,
 * validation, permissions, and mutation payloads exactly as they are.
 */
export type SelectionCardProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  selected?: boolean;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
};

export function SelectionCard({
  selected = false,
  title,
  description,
  icon,
  children,
  className,
  disabled,
  ...props
}: SelectionCardProps) {
  return (
    <button
      type="button"
      data-selection-card
      data-selected={selected ? 'true' : undefined}
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        'relative flex min-h-24 w-full min-w-0 flex-col rounded-xl border bg-card p-4 text-start outline-none transition-[background-color,border-color,box-shadow,transform] duration-150',
        'focus-visible:ring-4 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
        selected
          ? 'border-primary/60 bg-primary/[0.06] text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.12),0_8px_18px_hsl(var(--primary)/0.08)]'
          : 'border-border/80 text-foreground hover:border-primary/30 hover:bg-muted/30',
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-6">{title}</span>
          {description ? <span className="mt-1 block text-xs font-medium leading-5 text-muted-foreground">{description}</span> : null}
        </span>
        {icon ? <span className="shrink-0 text-primary" aria-hidden="true">{icon}</span> : null}
        {selected ? (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
            <Check className="size-3.5" />
          </span>
        ) : null}
      </span>
      {children ? <span className="mt-auto pt-3">{children}</span> : null}
    </button>
  );
}
