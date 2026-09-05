import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CheckboxProps = Readonly<{
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  /** Quiet second line under the label. */
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}>;

/**
 * Canonical labelled checkbox row.
 *
 * One shared control for every yes/no choice in a form or filter: the whole
 * row is the label (large touch target), the native input keeps keyboard and
 * screen-reader semantics, and the visual state is expressed with more than
 * colour alone. Feature-local fallbacks (e.g. `OwnerCheckbox`) are prohibited.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  id,
  className,
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      data-checkbox
      data-state={checked ? 'checked' : 'unchecked'}
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-muted/30 p-3 text-sm font-bold transition-colors',
        'has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/20',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--primary))]"
      />
      <span className="min-w-0">
        <span className="block leading-5">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs font-medium leading-5 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
