/**
 * EnterpriseEmptyState — Enterprise UX Foundation (Wave 4A)
 *
 * Consistent empty surface for lists, searches, permissions and drawers.
 * Visual sibling of the shared `EmptyState` primitive with added tone icons,
 * optional description, and primary/secondary action slots. Contains no
 * business logic — the module supplies copy.
 */

import { createElement, type ComponentType, type ReactNode } from 'react';
import { FileQuestion, Inbox, Lock, SearchX, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type EnterpriseEmptyTone = 'default' | 'search' | 'permission' | 'data';

export interface EnterpriseEmptyStateProps {
  title: string;
  description?: string;
  /** Visual tone chooses the leading icon; `icon` overrides it. */
  tone?: EnterpriseEmptyTone;
  icon?: LucideIcon | ComponentType<{ className?: string }>;
  /** Primary call-to-action (usually a Button). */
  action?: ReactNode;
  /** Secondary/ghost action rendered beside the primary one. */
  secondaryAction?: ReactNode;
  /** Reduce the minimum height for inline/panel contexts. */
  compact?: boolean;
  className?: string;
}

const toneIcons: Record<EnterpriseEmptyTone, LucideIcon | ComponentType<{ className?: string }>> = {
  default: Inbox,
  data: FileQuestion,
  search: SearchX,
  permission: Lock,
};

export function EnterpriseEmptyState({
  title,
  description,
  tone = 'default',
  icon,
  action,
  secondaryAction,
  compact = false,
  className,
}: EnterpriseEmptyStateProps) {
  const Icon = icon ?? toneIcons[tone];

  return (
    <Card
      data-enterprise-empty-state
      data-tone={tone}
      role="status"
      aria-live="polite"
      className={cn('border-dashed', className)}
    >
      <CardContent
        className={cn(
          'flex flex-col items-center justify-center gap-4 text-center',
          compact ? 'min-h-40 py-6' : 'min-h-56',
        )}
      >
        <div
          data-enterprise-empty-state-icon
          className="grid size-14 place-items-center rounded-xl bg-muted text-muted-foreground/40"
          aria-hidden="true"
        >
          {createElement(Icon, { className: 'size-7' })}
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {description ? (
            <p className="mt-1 max-w-md text-[0.8125rem] leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action || secondaryAction ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
