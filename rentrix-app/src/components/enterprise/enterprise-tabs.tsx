/**
 * EnterpriseTabs — Enterprise UX Foundation (Wave 4A)
 *
 * Config-driven tabs on top of the Radix Tabs primitive (roving focus,
 * arrow-key navigation, aria wiring come free). Used by EnterpriseForm and
 * available to modules directly.
 *
 * @example
 * <EnterpriseTabs
 *   tabs={[
 *     { id: 'general', label: 'عام', content: <GeneralSection /> },
 *     { id: 'financial', label: 'مالي', badge: 3, content: <FinancialSection /> },
 *   ]}
 *   value={tab}
 *   onValueChange={setTab}
 * />
 */

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface EnterpriseTab {
  id: string;
  label: string;
  /** Optional leading icon node (already sized). */
  icon?: ReactNode;
  /** Count/status badge rendered after the label. */
  badge?: number | string;
  disabled?: boolean;
  content?: ReactNode;
}

export interface EnterpriseTabsProps {
  tabs: EnterpriseTab[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (tabId: string) => void;
  /** Tabs bar visual: `line` (underline) or `pills`. */
  variant?: 'line' | 'pills';
  /** Pin the tab bar within the scrolling container. */
  stickyList?: boolean;
  className?: string;
  listClassName?: string;
  contentClassName?: string;
}

export function EnterpriseTabs({
  tabs,
  value,
  defaultValue,
  onValueChange,
  variant = 'line',
  stickyList = false,
  className,
  listClassName,
  contentClassName,
}: EnterpriseTabsProps) {
  const firstEnabled = tabs.find((tab) => !tab.disabled)?.id;

  return (
    <TabsPrimitive.Root
      data-enterprise-tabs
      value={value}
      defaultValue={value === undefined ? defaultValue ?? firstEnabled : undefined}
      onValueChange={onValueChange}
      className={cn('min-w-0', className)}
    >
      <TabsPrimitive.List
        aria-label="علامات التبويب"
        className={cn(
          'flex items-center gap-1 overflow-x-auto',
          variant === 'line' && 'border-b border-border',
          variant === 'pills' && 'rounded-xl bg-muted p-1',
          stickyList && 'sticky top-0 z-10 bg-card',
          listClassName,
        )}
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className={cn(
              'group relative flex min-h-10 items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-semibold text-muted-foreground',
              'transition-colors duration-200 hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              variant === 'line' &&
                'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent after:transition-colors data-[state=active]:text-foreground data-[state=active]:after:bg-primary',
              variant === 'pills' &&
                'rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined ? (
              <Badge variant="neutral" className="px-1.5">
                {tab.badge}
              </Badge>
            ) : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {tabs.map((tab) => (
        <TabsPrimitive.Content
          key={tab.id}
          value={tab.id}
          className={cn('pt-4 outline-none focus-visible:ring-4 focus-visible:ring-primary/20', contentClassName)}
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
