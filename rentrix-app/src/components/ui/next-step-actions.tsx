import React from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, CheckCircle2, ChevronLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canShowNavigationItem, type AppPermission } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';

export interface NextStepActionItem {
  id: string;
  label: string;
  description?: string;
  to: string;
  search?: Record<string, unknown>;
  params?: Record<string, string>;
  permission?: AppPermission;
  icon?: LucideIcon;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

export interface NextStepActionsProps {
  title?: string;
  subtitle?: string;
  actions: readonly NextStepActionItem[];
  className?: string;
}

/**
 * Reusable NextStepActions component that displays contextual, permission-aware
 * logical follow-up actions after completing domain operations.
 */
export function NextStepActions({
  title = 'الخطوة التالية الموصى بها',
  subtitle = 'إجراءات تكميلية لسير العمل العقاري والمالي',
  actions,
  className = '',
}: NextStepActionsProps) {
  const { authorization } = useAuth();

  const visibleActions = actions.filter((action) =>
    canShowNavigationItem(authorization, action.permission),
  );

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 ${className}`}
      role="region"
      aria-label={title}
      data-next-step-actions
    >
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CheckCircle2 className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {visibleActions.map((action) => {
          const Icon = action.icon ?? ArrowRight;
          return (
            <Button
              key={action.id}
              variant={action.variant ?? 'outline'}
              className="h-auto justify-between gap-2 p-3 text-start font-semibold border-primary/20 bg-background/80 hover:bg-background"
              asChild
            >
              <Link
                to={action.to}
                params={action.params ?? {}}
                search={action.search ?? {}}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="truncate">{action.label}</div>
                    {action.description ? (
                      <div className="truncate text-[11px] font-normal text-muted-foreground">
                        {action.description}
                      </div>
                    ) : null}
                  </div>
                </div>
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
