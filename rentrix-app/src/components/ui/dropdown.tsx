import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export type DropdownOption = {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type DropdownProps = {
  options: DropdownOption[];
  value?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Lightweight single-select dropdown for filters and compact selectors.
 * Prefer native Select for long option lists and form accessibility defaults.
 */
export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'اختر...',
  label,
  disabled = false,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative min-w-0', className)}>
      {label ? <p className="mb-1.5 text-xs font-bold text-muted-foreground">{label}</p> : null}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className="w-full justify-between gap-2 font-bold"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn('size-4 shrink-0 transition', open && 'rotate-180')} />
      </Button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          className="absolute start-0 end-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-border bg-card p-1 shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.id === value;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                className={cn(
                  'flex min-h-11 w-full items-start gap-2 rounded-xl px-3 py-2 text-right transition',
                  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  'disabled:pointer-events-none disabled:opacity-50',
                  isSelected && 'bg-primary/10 text-primary',
                )}
                onClick={() => {
                  if (option.disabled) return;
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                {option.icon ? <span className="mt-0.5 shrink-0">{option.icon}</span> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block text-[11px] font-bold text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
