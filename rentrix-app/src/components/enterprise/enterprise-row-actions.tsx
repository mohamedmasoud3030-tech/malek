/**
 * EnterpriseRowActions — Enterprise UX Foundation (Wave 4A)
 *
 * Per-record action menu (⋯ trigger) for table rows, cards and list items.
 * Built on Radix DropdownMenu: keyboard navigation, type-ahead, focus return
 * and portal positioning are inherited from the primitive. Destructive items
 * get the danger tone and a separator. No business logic.
 *
 * @example
 * <EnterpriseRowActions
 *   label="إجراءات العقد"
 *   items={[
 *     { id: 'view', label: 'عرض', icon: Eye, onSelect: () => open(row) },
 *     { id: 'delete', label: 'حذف', icon: Trash2, destructive: true, onSelect: () => confirm(row) },
 *   ]}
 * />
 */

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { createElement, type ComponentType } from 'react';
import { cn } from '@/lib/utils';

export interface EnterpriseRowActionItem {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** Danger tone + separator above the item. */
  destructive?: boolean;
  disabled?: boolean;
  /** Hide entirely (permission-gated actions should hide, not disable). */
  hidden?: boolean;
  /** Keyboard hint text rendered at the trailing edge. */
  shortcut?: string;
  onSelect: () => void;
}

export interface EnterpriseRowActionsProps {
  items: EnterpriseRowActionItem[];
  /** Accessible name of the trigger (e.g. "إجراءات العقد 12"). */
  label?: string;
  align?: 'start' | 'center' | 'end';
  /** Larger target for standalone cards; `sm` fits dense table rows. */
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  /** Extra classes for the trigger button (e.g. sticky-cell backgrounds). */
  triggerClassName?: string;
}

export function EnterpriseRowActions({
  items,
  label = 'الإجراءات',
  align = 'end',
  size = 'sm',
  disabled = false,
  className,
  triggerClassName,
}: EnterpriseRowActionsProps) {
  const visibleItems = items.filter((item) => !item.hidden);
  if (visibleItems.length === 0) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          data-enterprise-row-actions-trigger
          className={cn(
            'grid place-items-center rounded-lg text-muted-foreground transition-colors duration-200',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
            'data-[state=open]:bg-muted data-[state=open]:text-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
            size === 'sm' ? 'size-8' : 'size-10',
            triggerClassName,
            className,
          )}
        >
          <MoreVertical className={size === 'sm' ? 'size-4' : 'size-5'} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={6}
          className={cn(
            'z-dropdown min-w-44 overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-elevated',
          )}
        >
          {visibleItems.map((item, index) => {
            const previousDestructive = index > 0 && !visibleItems[index - 1].destructive;
            return (
              <div key={item.id}>
                {item.destructive && previousDestructive ? (
                  <DropdownMenu.Separator className="my-1 h-px bg-border/60" />
                ) : null}
                <DropdownMenu.Item
                  disabled={item.disabled}
                  onSelect={item.onSelect}
                  className={cn(
                    'flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium outline-none',
                    'transition-colors duration-150',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                    item.destructive
                      ? 'text-danger data-[highlighted]:bg-danger/10'
                      : 'text-foreground data-[highlighted]:bg-muted',
                  )}
                >
                  {item.icon ? createElement(item.icon, { className: 'size-4 shrink-0' }) : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.shortcut ? (
                    <kbd className="ms-auto text-[0.6875rem] font-medium text-muted-foreground">
                      {item.shortcut}
                    </kbd>
                  ) : null}
                </DropdownMenu.Item>
              </div>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
