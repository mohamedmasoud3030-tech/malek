import { MoreVertical } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { cn } from '@/lib/utils';

interface PageHeaderActionsProps {
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  backTo?: string;
  backLabel?: string;
  title?: string;
}

/**
 * Mobile-aware actions rail for PageHeader and EmbeddableWorkspace.
 * - Primary action always visible (compact on mobile).
 * - Secondary actions inline on desktop, collapsed into accessible overflow on mobile.
 * - Destructive actions visually separated (handled by button variants).
 * - Touch targets 44px min.
 * - Safe-area padding preserved via BottomSheet.
 * - Menus stay within viewport (BottomSheet).
 * - Icon-only buttons have accessible names via Button's aria-label (caller responsibility, but we enforce via overflow).
 */
export function PageHeaderActions({ primaryAction, secondaryActions, title }: PageHeaderActionsProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  const hasSecondary = Boolean(secondaryActions);
  const hasPrimary = Boolean(primaryAction);

  if (!hasSecondary && !hasPrimary) return null;

  return (
    <>
      <div
        className={cn(
          'flex min-w-0 items-center justify-end gap-1.5 sm:gap-2',
          // Mobile: prevent horizontal overflow, allow wrap only on desktop
          'max-w-[62vw] sm:max-w-none',
          'shrink-0',
        )}
        data-page-actions
      >
        {/* Secondary actions — desktop inline, mobile hidden */}
        {hasSecondary ? (
          <div
            className="hidden sm:flex items-center gap-1.5 sm:gap-2"
            aria-label="إجراءات ثانوية"
            data-secondary-actions-desktop
          >
            {secondaryActions}
          </div>
        ) : null}

        {/* Mobile overflow button for secondary actions */}
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

        {/* Primary action — always visible, compact on mobile */}
        {hasPrimary ? (
          <div className="shrink-0" data-primary-action>
            {/* Ensure touch target 44px; caller should use Button with min-h-11 */}
            <div className="flex items-center">
              {/* Wrap to enforce min touch target even if child is icon-only */}
              <div className="min-h-11 flex items-center">{primaryAction}</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Mobile bottom sheet overflow */}
      {hasSecondary ? (
        <BottomSheet open={overflowOpen} onClose={() => setOverflowOpen(false)} title={title ? `إجراءات ${title}` : 'إجراءات إضافية'}>
          <div className="grid gap-2" data-secondary-actions-mobile>
            {/* Clone secondary actions with full-width styling for mobile */}
            <div className="grid gap-2">
              {/* We render secondaryActions twice but second time we force full width via CSS */}
              <div className="grid gap-2 [&_button]:min-h-12 [&_button]:w-full [&_button]:justify-start">
                {secondaryActions}
              </div>
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
