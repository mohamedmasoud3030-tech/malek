/**
 * EnterpriseBulkActions — Enterprise UX Foundation (Wave 4A)
 *
 * Selection action bar for lists: "N selected · [export] [archive] [clear]".
 * - `position="inline"` renders inside the toolbar row
 * - `position="floating"` renders a centered bottom pill (mobile-friendly)
 * - Actions flagged `confirm` gate through EnterpriseConfirmDialog
 *
 * The module owns what each action does; the bar owns presentation + gating.
 */

import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EnterpriseConfirmDialog } from './enterprise-confirm-dialog';

export interface EnterpriseBulkAction {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  destructive?: boolean;
  disabled?: boolean;
  /** When set, selecting the action opens a confirmation dialog. */
  confirm?: {
    title: string;
    description?: string;
    confirmLabel?: string;
    requireText?: string;
  };
  onSelect: () => void;
}

export interface EnterpriseBulkActionsProps {
  /** Number of selected records (render the bar only when > 0). */
  selectedCount: number;
  actions: EnterpriseBulkAction[];
  onClear?: () => void;
  position?: 'inline' | 'floating';
  /** Extra summary node (e.g. "total: 12,500 ر.ع") between count and actions. */
  summary?: ReactNode;
  className?: string;
}

export function EnterpriseBulkActions({
  selectedCount,
  actions,
  onClear,
  position = 'inline',
  summary,
  className,
}: EnterpriseBulkActionsProps) {
  const [pendingAction, setPendingAction] = useState<EnterpriseBulkAction | null>(null);
  const visibleActions = useMemo(() => actions.filter((action) => !action.disabled), [actions]);

  if (selectedCount <= 0 || visibleActions.length === 0) return null;

  const run = (action: EnterpriseBulkAction) => {
    if (action.confirm) setPendingAction(action);
    else action.onSelect();
  };

  return (
    <>
      <div
        data-enterprise-bulk-actions
        data-position={position}
        role="toolbar"
        aria-label="إجراءات التحديد"
        className={cn(
          'flex flex-wrap items-center gap-2',
          position === 'inline' && 'rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2',
          position === 'floating' &&
            'fixed inset-x-4 bottom-4 z-sticky mx-auto w-fit max-w-full rounded-2xl border border-border bg-card px-4 py-2.5 shadow-elevated sm:inset-x-0',
          className,
        )}
      >
        <Badge variant="primary" className="tabular-nums">
          {selectedCount}
        </Badge>
        <span className="text-sm font-semibold text-primary">عنصر محدد</span>
        {summary ? <span className="text-xs text-muted-foreground">{summary}</span> : null}

        <div className="ms-1 flex flex-wrap items-center gap-1.5">
          {visibleActions.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.destructive ? 'danger' : 'secondary'}
              onClick={() => run(action)}
            >
              {action.icon ? <action.icon className="size-4" aria-hidden="true" /> : null}
              {action.label}
            </Button>
          ))}
          {onClear ? (
            <Button type="button" size="sm" variant="ghost" onClick={onClear} aria-label="إلغاء التحديد">
              <X className="size-4" aria-hidden="true" />
              إلغاء
            </Button>
          ) : null}
        </div>
      </div>

      <EnterpriseConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        tone={pendingAction?.destructive ? 'danger' : 'warning'}
        title={pendingAction?.confirm?.title ?? ''}
        description={pendingAction?.confirm?.description}
        confirmLabel={pendingAction?.confirm?.confirmLabel ?? 'تأكيد'}
        requireText={pendingAction?.confirm?.requireText}
        onConfirm={() => {
          pendingAction?.onSelect();
          setPendingAction(null);
        }}
      />
    </>
  );
}
