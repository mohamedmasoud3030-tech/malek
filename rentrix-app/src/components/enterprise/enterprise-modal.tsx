/**
 * EnterpriseModal — Enterprise UX Foundation (Wave 4A)
 *
 * Centered dialog for short focused flows (single-step forms, detail
 * previews, decisions). Same dismissal grammar as EnterpriseDrawer:
 * dirty-gated Escape/scrim/close, sticky footer with action shortcuts,
 * loading + readonly states. No business logic.
 */

import type { ComponentType, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useUnsavedDismiss } from './hooks/use-unsaved-dismiss';
import { EnterpriseConfirmDialog } from './enterprise-confirm-dialog';
import { EnterpriseLoadingState } from './enterprise-loading-state';
import type { EnterpriseDrawerAction } from './enterprise-drawer';

export type EnterpriseModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface EnterpriseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;

  size?: EnterpriseModalSize;

  isDirty?: boolean;
  warnOnUnsavedChanges?: boolean;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;

  isLoading?: boolean;
  readOnly?: boolean;

  footer?: ReactNode;
  primaryAction?: EnterpriseDrawerAction;
  secondaryAction?: EnterpriseDrawerAction;

  children?: ReactNode;
  className?: string;
}

const sizeClasses: Record<EnterpriseModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export function EnterpriseModal({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  size = 'md',
  isDirty = false,
  warnOnUnsavedChanges = true,
  closeOnEscape = true,
  closeOnOutsideClick = true,
  isLoading = false,
  readOnly = false,
  footer,
  primaryAction,
  secondaryAction,
  children,
  className,
}: EnterpriseModalProps) {
  const dismiss = useUnsavedDismiss({
    isDirty,
    warnOnDismiss: warnOnUnsavedChanges,
    onClose: () => onOpenChange(false),
  });

  const hasFooter = footer !== undefined || primaryAction !== undefined || secondaryAction !== undefined;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
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
          className={cn('gap-0 p-0', sizeClasses[size], className)}
          data-enterprise-modal
        >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              {Icon ? (
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
                  <Icon className="size-5" />
                </span>
              ) : null}
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold">{title}</DialogTitle>
                {description ? (
                  <DialogDescription className="mt-1 text-xs font-medium text-muted-foreground">
                    {description}
                  </DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">{title}</DialogDescription>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0"
              onClick={dismiss.requestClose}
              aria-label="إغلاق"
            >
              <X className="size-5" />
            </Button>
          </div>

          <div className="max-h-[70dvh] overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            {isLoading ? (
              <EnterpriseLoadingState context="drawer" />
            ) : readOnly ? (
              <fieldset disabled className="contents" aria-readonly="true">
                {children}
              </fieldset>
            ) : (
              children
            )}
          </div>

          {hasFooter ? (
            <div className="flex flex-col-reverse gap-3 border-t border-border px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:flex-row sm:justify-end sm:px-6">
              {footer ?? (
                <>
                  {secondaryAction ? (
                    <Button
                      variant="secondary"
                      onClick={secondaryAction.onClick ?? dismiss.requestClose}
                      disabled={secondaryAction.disabled || secondaryAction.loading}
                    >
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
                      ) : null}
                      {primaryAction.label}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
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
