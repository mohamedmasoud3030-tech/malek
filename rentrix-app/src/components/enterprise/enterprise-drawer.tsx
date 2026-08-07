/**
 * EnterpriseDrawer — Enterprise UX Foundation (Wave 4A)
 *
 * The canonical side-sheet for create / edit / view / preview workflows:
 *
 * - `mode` — semantic workflow intent (drives the mode chip + aria copy)
 * - responsive widths (`sm` … `full`)
 * - Escape / scrim dismissal (can be disabled)
 * - unsaved-changes warning via `isDirty` (all dismissal paths gated)
 * - sticky body + EnterpriseStickyFooter (convenience primary/secondary
 *   action props, or a free-form `footer` slot)
 * - overlay loading state, validation banner, readonly mode
 * - a11y: focus trap + labelled dialog come from the Radix primitive
 *
 * No business logic: forms, payloads and mutations belong to the module.
 *
 * @example
 * const drawer = useDrawer<Property>();
 * <EnterpriseDrawer
 *   {...drawer.bind}
 *   title={drawer.mode === 'create' ? 'عقار جديد' : 'تعديل عقار'}
 *   primaryAction={{ label: 'حفظ', onClick: save, loading: saving }}
 *   secondaryAction={{ label: 'إلغاء', onClick: drawer.close }}
 * >
 *   <PropertyForm onDirtyChange={drawer.setDirty} />
 * </EnterpriseDrawer>
 */

import type { ComponentType, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { EnterpriseDrawerMode } from './hooks/use-drawer';
import { useUnsavedDismiss } from './hooks/use-unsaved-dismiss';
import { EnterpriseConfirmDialog } from './enterprise-confirm-dialog';
import { EnterpriseLoadingState } from './enterprise-loading-state';
import { EnterpriseStickyFooter } from './enterprise-sticky-footer';

export interface EnterpriseDrawerAction {
  label: string;
  onClick?: () => void;
  /** Submit-style action (accesskey hint only — submission stays in the form). */
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  loading?: boolean;
}

export type EnterpriseDrawerWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface EnterpriseDrawerProps {
  open: boolean;
  /** Fires whenever the drawer wants to change visibility (dirty-gated internally). */
  onOpenChange: (open: boolean) => void;
  mode?: EnterpriseDrawerMode;

  title: string;
  description?: string;
  /** Header trailing slot (before the close button). */
  headerActions?: ReactNode;
  /** Show the workflow-mode chip under the title. Default true when mode set. */
  showModeBadge?: boolean;

  width?: EnterpriseDrawerWidth;
  side?: 'right' | 'left' | 'bottom';

  // Dismissal behavior
  /** Report form dirtiness — dirty drawers warn before any dismissal. */
  isDirty?: boolean;
  /** Disable the unsaved-changes gate. Default true (warn). */
  warnOnUnsavedChanges?: boolean;
  /** Escape key closes. Default true. */
  closeOnEscape?: boolean;
  /** Clicking the scrim closes. Default true. */
  closeOnOutsideClick?: boolean;

  // State surfaces
  /** Cover the body with the drawer skeleton (initial-load state). */
  isLoading?: boolean;
  /** Validation messages (form errors) shown as a banner above the body. */
  validationErrors?: string[];
  validationTitle?: string;
  /** Readonly mode — disables every control inside the body. */
  readOnly?: boolean;

  // Footer
  footer?: ReactNode;
  primaryAction?: EnterpriseDrawerAction;
  secondaryAction?: EnterpriseDrawerAction;

  children?: ReactNode;
  className?: string;
}

const widthClasses: Record<EnterpriseDrawerWidth, string> = {
  sm: 'w-[min(24rem,92vw)]',
  md: 'w-[min(30rem,94vw)]',
  lg: 'w-[min(38rem,96vw)]',
  xl: 'w-[min(48rem,98vw)]',
  full: 'w-screen',
};

// Placement classes mirrored from `components/ui/drawer.tsx` so the shared
// DialogContent placement detection (className sniffing) keeps working.
const sideClasses: Record<NonNullable<EnterpriseDrawerProps['side']>, string> = {
  right:
    'fixed bottom-0 left-auto right-0 top-0 z-[101] flex h-dvh max-h-none max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 border-l border-border p-0 sm:max-h-none sm:p-0',
  left:
    'fixed bottom-0 left-0 right-auto top-0 z-[101] flex h-dvh max-h-none max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 border-r border-border p-0 sm:max-h-none sm:p-0',
  bottom:
    'fixed inset-x-0 bottom-0 top-auto z-[101] flex max-h-[88dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-t-3xl border-0 border-t border-border p-0 sm:max-w-none sm:p-0',
};

export const enterpriseDrawerModeLabels: Record<EnterpriseDrawerMode, string> = {
  create: 'إنشاء',
  edit: 'تعديل',
  view: 'عرض',
  preview: 'معاينة',
};

export function EnterpriseDrawer({
  open,
  onOpenChange,
  mode = 'edit',
  title,
  description,
  headerActions,
  showModeBadge = true,
  width = 'md',
  side = 'right',
  isDirty = false,
  warnOnUnsavedChanges = true,
  closeOnEscape = true,
  closeOnOutsideClick = true,
  isLoading = false,
  validationErrors,
  validationTitle = 'يرجى تصحيح الأخطاء التالية:',
  readOnly = false,
  footer,
  primaryAction,
  secondaryAction,
  children,
  className,
}: EnterpriseDrawerProps) {
  const dismiss = useUnsavedDismiss({
    isDirty,
    warnOnDismiss: warnOnUnsavedChanges,
    onClose: () => onOpenChange(false),
  });

  const hasFooter = footer !== undefined || primaryAction !== undefined || secondaryAction !== undefined;
  const defaultReadOnly = readOnly || mode === 'view' || mode === 'preview';

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen: boolean) => {
          if (nextOpen) onOpenChange(true);
          else dismiss.requestClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => {
            if (!closeOnEscape) {
              event.preventDefault();
              return;
            }
            // Route Escape through the dirty gate (Radix would close directly).
            if (warnOnUnsavedChanges && isDirty) {
              event.preventDefault();
              dismiss.requestClose();
            }
          }}
          onPointerDownOutside={(event) => {
            if (!closeOnOutsideClick || (warnOnUnsavedChanges && isDirty)) {
              event.preventDefault();
              if (warnOnUnsavedChanges && isDirty && closeOnOutsideClick) dismiss.requestClose();
            }
          }}
          className={cn(
            sideClasses[side],
            side !== 'bottom' && widthClasses[width],
            'bg-card text-card-foreground shadow-xl',
            className,
          )}
          data-enterprise-drawer
          data-mode={mode}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="truncate text-base font-bold">{title}</DialogTitle>
                {showModeBadge && mode ? (
                  <Badge
                    variant={mode === 'create' ? 'success' : mode === 'edit' ? 'info' : 'neutral'}
                    data-enterprise-drawer-mode
                  >
                    {enterpriseDrawerModeLabels[mode]}
                  </Badge>
                ) : null}
              </div>
              {description ? (
                <DialogDescription className="mt-1 text-xs font-medium text-muted-foreground">
                  {description}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{title}</DialogDescription>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={dismiss.requestClose}
                aria-label="إغلاق"
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>

          <div className="relative flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-4 p-4 sm:p-6">
              {validationErrors && validationErrors.length > 0 ? (
                <div
                  data-enterprise-drawer-validation
                  role="alert"
                  className="rounded-xl border border-danger/25 bg-danger-bg px-3 py-2.5 text-sm text-danger"
                >
                  <p className="font-bold">{validationTitle}</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-[0.8125rem] font-medium">
                    {validationErrors.map((message, index) => (
                      <li key={`${index}-${message}`}>{message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {isLoading ? (
                <EnterpriseLoadingState context="drawer" />
              ) : defaultReadOnly ? (
                <fieldset disabled className="contents" aria-readonly="true">
                  {children}
                </fieldset>
              ) : (
                children
              )}
            </div>
          </div>

          {hasFooter ? (
            <EnterpriseStickyFooter align="end">
              {footer ?? (
                <>
                  {secondaryAction ? (
                    <Button
                      variant="secondary"
                      onClick={secondaryAction.onClick ?? dismiss.requestClose}
                      disabled={secondaryAction.disabled || secondaryAction.loading}
                    >
                      {secondaryAction.icon ? (
                        <secondaryAction.icon className="size-4" aria-hidden="true" />
                      ) : null}
                      {secondaryAction.label}
                    </Button>
                  ) : null}
                  {primaryAction ? (
                    <Button
                      variant="primary"
                      onClick={primaryAction.onClick}
                      disabled={primaryAction.disabled || primaryAction.loading || isLoading}
                    >
                      {primaryAction.loading ? (
                        <span
                          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                          aria-hidden="true"
                        />
                      ) : primaryAction.icon ? (
                        <primaryAction.icon className="size-4" aria-hidden="true" />
                      ) : null}
                      {primaryAction.label}
                    </Button>
                  ) : null}
                </>
              )}
            </EnterpriseStickyFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <EnterpriseConfirmDialog
        open={dismiss.showDismissWarning}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) dismiss.cancelDismiss();
        }}
        tone="warning"
        title="تغييرات غير محفوظة"
        description="لديك تغييرات لم يتم حفظها. هل تريد تجاهلها والإغلاق؟"
        confirmLabel="تجاهل التغييرات"
        cancelLabel="مواصلة التحرير"
        onConfirm={dismiss.confirmDismiss}
      />
    </>
  );
}
