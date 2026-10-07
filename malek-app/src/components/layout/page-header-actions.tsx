import { MoreVertical } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';

interface PageHeaderActionsProps {
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  title?: string;
}

/**
 * Canonical mobile-aware action group shared by PageHeader and embedded workspaces.
 * Primary actions stay visible; secondary actions remain inline on desktop and
 * move into the accessible mobile overflow sheet. Touch targets keep the 44px floor.
 */
export function PageHeaderActions({ primaryAction, secondaryActions, title }: PageHeaderActionsProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const hasSecondary = Boolean(secondaryActions);
  const hasPrimary = Boolean(primaryAction);

  if (!hasSecondary && !hasPrimary) return null;

  return (
    <>
      <div
        className="flex min-w-0 max-w-full shrink-0 items-center justify-end gap-1.5 overflow-hidden sm:max-w-none sm:gap-2"
        data-page-actions
      >
        {hasSecondary ? (
          <div
            className="hidden min-w-0 items-center gap-1.5 overflow-hidden sm:flex sm:gap-2"
            aria-label="إجراءات ثانوية"
            data-secondary-actions-desktop
          >
            {secondaryActions}
          </div>
        ) : null}

        {hasSecondary ? (
          <div className="sm:hidden" data-secondary-overflow-trigger>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11 min-w-11 px-2.5"
              aria-label="إجراءات إضافية"
              aria-haspopup="dialog"
              aria-expanded={overflowOpen}
              onClick={() => setOverflowOpen(true)}
            >
              <MoreVertical className="size-4" aria-hidden="true" />
              <span className="sr-only">المزيد</span>
            </Button>
          </div>
        ) : null}

        {hasPrimary ? (
          <div className="flex min-h-11 shrink-0 items-center" data-primary-action>
            {primaryAction}
          </div>
        ) : null}
      </div>

      {hasSecondary ? (
        <BottomSheet
          open={overflowOpen}
          onClose={() => setOverflowOpen(false)}
          title={title ? `إجراءات ${title}` : 'إجراءات إضافية'}
        >
          <div className="grid gap-2" data-secondary-actions-mobile>
            <div className="grid gap-2 [&_button]:min-h-12 [&_button]:w-full [&_button]:justify-start">
              {secondaryActions}
            </div>
            <Button variant="secondary" className="mt-2 min-h-11 w-full" onClick={() => setOverflowOpen(false)}>
              إغلاق
            </Button>
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}
