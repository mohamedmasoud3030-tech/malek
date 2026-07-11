import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dropdown } from '@/components/ui/dropdown';
import { cn } from '@/lib/utils';

export interface ActionItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}

export interface ActionMenuProps {
  items: ActionItem[];
  label?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function ActionMenu({ items, label = 'الإجراءات', align = 'end', className }: ActionMenuProps) {
  const visibleItems = items.filter((item) => !item.disabled);
  
  if (visibleItems.length === 0) {
    return null;
  }

  if (visibleItems.length === 1) {
    const item = visibleItems[0];
    const Icon = item.icon;
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={item.onClick}
        className={cn('h-9 min-w-9 px-2', className)}
        aria-label={item.label}
      >
        {Icon && <Icon className="size-4" />}
      </Button>
    );
  }

  const options = visibleItems.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    disabled: item.disabled,
  }));

  const handleChange = (id: string) => {
    const item = visibleItems.find((item) => item.id === id);
    item?.onClick();
  };

  return (
    <div className={cn('w-32', className)}>
      <Dropdown
        options={options}
        onChange={handleChange}
        placeholder={label}
        label=""
      />
    </div>
  );
}

// ============================================================
// Quick Action Bar for Entity Pages
// ============================================================

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export interface QuickActionBarProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActionBar({ actions, className }: QuickActionBarProps) {
  const visibleActions = actions.filter((a) => !a.disabled && !a.loading);

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant={action.variant ?? 'secondary'}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
            className={cn('min-h-10 gap-2', action.className)}
          >
            {action.loading ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              Icon && <Icon className="size-4" />
            )}
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}

// ============================================================
// Mobile-Friendly Action Grid
// ============================================================

export interface MobileActionGridProps {
  actions: QuickAction[];
  className?: string;
}

export function MobileActionGrid({ actions, className }: MobileActionGridProps) {
  const visibleActions = actions.filter((a) => !a.disabled);

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-4', className)}>
      {visibleActions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            variant={action.variant ?? 'secondary'}
            onClick={action.onClick}
            disabled={action.disabled}
            className="min-h-14 flex-col gap-1.5 py-3"
          >
            {Icon && <Icon className="size-5" />}
            <span className="text-xs font-bold">{action.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
