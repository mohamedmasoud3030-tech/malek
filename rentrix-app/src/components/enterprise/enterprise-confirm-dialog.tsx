/**
 * EnterpriseConfirmDialog — Enterprise UX Foundation (Wave 4A)
 *
 * Standard confirmation gate for destructive or consequential actions.
 * Wraps the shared `ConfirmDialog` primitive and adds:
 *  - `tone` (danger | warning) for visual severity
 *  - `requireText` type-to-confirm for high-risk irreversible actions
 *  - Async-safe busy handling (blocks dismissal while `isLoading`)
 *
 * No business logic — modules own copy and the action being confirmed.
 */

import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';

export interface EnterpriseConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
  /** Disable all dismissal paths while an async action runs. */
  isLoading?: boolean;
  /**
   * When set, typing this exact phrase is required before the confirm
   * button enables (classic destructive-action friction).
   */
  requireText?: string;
  /** Helper copy shown above the type-to-confirm input. */
  requireTextHint?: string;
  onConfirm: () => void;
  children?: React.ReactNode;
}

export function EnterpriseConfirmDialog({
  open,
  onOpenChange,
  title = 'هل أنت متأكد؟',
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  tone = 'danger',
  isLoading = false,
  requireText,
  requireTextHint,
  onConfirm,
  children,
}: EnterpriseConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  const needsTyping = typeof requireText === 'string' && requireText.length > 0;
  const confirmedPhrase = !needsTyping || typed.trim() === requireText.trim();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      variant={tone}
      isLoading={isLoading}
      confirmDisabled={needsTyping && !confirmedPhrase}
      onConfirm={onConfirm}
    >
      {children}
      {needsTyping ? (
        <div data-enterprise-confirm-require className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {requireTextHint ?? `اكتب «${requireText}» للمتابعة.`}
          </p>
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={isLoading}
            aria-label={requireTextHint ?? `اكتب ${requireText} للمتابعة`}
            autoComplete="off"
          />
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
