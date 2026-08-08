/*
 * ============================================
 * MALIK PRO - Tabs Component
 * Filter tabs with pill-style design
 * ============================================
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MalikTab {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export interface MalikTabsProps {
  tabs: MalikTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

export function MalikTabs({
  tabs,
  activeTab,
  onTabChange,
  variant = 'pills',
  className,
}: MalikTabsProps) {
  if (variant === 'underline') {
    return (
      <div
        role="tablist"
        className={cn(
          'flex border-b border-[hsl(var(--malik-border))]',
          className
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            data-malik-tab={activeTab === tab.id ? 'active' : undefined}
            className={cn(
              'relative flex items-center gap-2 px-4 py-3',
              'text-sm font-medium transition-colors duration-150',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'text-[hsl(var(--malik-primary))] border-[hsl(var(--malik-primary))]'
                : 'text-[hsl(var(--malik-foreground-muted))] border-transparent',
              'hover:text-[hsl(var(--malik-foreground))]'
            )}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-bold',
                  activeTab === tab.id
                    ? 'bg-[hsl(var(--malik-primary))] text-white'
                    : 'bg-[hsl(var(--malik-muted))] text-[hsl(var(--malik-foreground-muted))]'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Default/Pills variant
  return (
    <div
      role="tablist"
      data-malik-tabs
      className={cn(
        'flex flex-wrap gap-1 p-1',
        'bg-[hsl(var(--malik-muted))] rounded-xl',
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          data-malik-tab={activeTab === tab.id && 'active'}
          className={cn(
            'flex-1 flex items-center justify-center gap-2',
            'min-h-[44px] px-4 py-2',
            'text-sm font-medium transition-all duration-150',
            'rounded-lg',
            activeTab === tab.id
              ? 'bg-[hsl(var(--malik-card))] text-[hsl(var(--malik-foreground))] shadow-[0_2px_8px_-4px_rgba(15,23,42,0.2)] font-bold'
              : 'text-[hsl(var(--malik-foreground-muted))]',
            'hover:text-[hsl(var(--malik-foreground))]'
          )}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-bold',
                activeTab === tab.id
                  ? 'bg-[hsl(var(--malik-primary-soft))] text-[hsl(var(--malik-primary-dark))]'
                  : 'bg-[hsl(var(--malik-border-light))] text-[hsl(var(--malik-foreground-muted))]'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Filter Tabs ──
export interface MalikFilterTab {
  id: string;
  label: string;
  count?: number;
}

export interface MalikFilterTabsProps {
  tabs: MalikFilterTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function MalikFilterTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
}: MalikFilterTabsProps) {
  return (
    <div
      role="tablist"
      data-malik-tabs
      className={cn(
        'inline-flex gap-1 p-1',
        'bg-[hsl(var(--malik-muted))] rounded-xl',
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          data-malik-tab={activeTab === tab.id ? 'active' : undefined}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5',
            'text-xs font-bold transition-all duration-150',
            'rounded-lg',
            activeTab === tab.id
              ? 'bg-[hsl(var(--malik-card))] text-[hsl(var(--malik-foreground))] shadow-[0_2px_6px_-2px_rgba(15,23,42,0.15)]'
              : 'text-[hsl(var(--malik-foreground-muted))]',
            'hover:text-[hsl(var(--malik-foreground))]'
          )}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px]',
                activeTab === tab.id
                  ? 'bg-[hsl(var(--malik-primary))] text-white'
                  : 'bg-[hsl(var(--malik-border-light))]'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
