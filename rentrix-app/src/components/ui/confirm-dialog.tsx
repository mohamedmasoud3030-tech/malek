import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void;
}

/**
 * Reusable confirmation dialog for destructive actions (delete, terminate…).
 * Replaces ad-hoc `window.confirm()` calls and one-off dialog implementations.
 *
 * @example
 * <ConfirmDialog
 *   open={showDelete}
 *   onOpenChange={setShowDelete}
 *   title="حذف العقار؟"
 *   description="لا يمكن التراجع عن هذا الإجراء."
 *   onConfirm={handleDelete}
 * />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'هل أنت متأكد؟',
  description = 'لا يمكن التراجع عن هذا الإجراء.',
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  variant = 'danger',
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  function handleOpenChange(nextOpen: boolean) {
    if (isLoading && !nextOpen) return;
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-sm gap-0 p-5 sm:p-6"
        showCloseButton={!isLoading}
        onEscapeKeyDown={(event) => {
          if (isLoading) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isLoading) event.preventDefault();
        }}
      >
        <div className="mb-4 flex items-start gap-3 pe-10">
          <div className={
            variant === 'danger'
              ? 'grid size-10 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
              : 'grid size-10 place-items-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
          }>
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-base font-black">{title}</DialogTitle>
            {description && (
              <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            className="sm:min-w-28"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            className="sm:min-w-32"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'جارٍ التنفيذ...' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
