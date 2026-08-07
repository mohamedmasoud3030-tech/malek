/**
 * useUnsavedDismiss — Enterprise UX Foundation (Wave 4A)
 *
 * Shared dismissal gate for EnterpriseDrawer / EnterpriseModal: any close
 * attempt (Escape, scrim click, close button, footer cancel) is routed
 * through `requestClose`, which either closes immediately or raises
 * `showDismissWarning` when the hosted form is dirty.
 *
 * The overlay component renders the warning copy itself (EnterpriseDrawer /
 * EnterpriseModal mount EnterpriseConfirmDialog with these bindings).
 */

import { useCallback, useState } from 'react';

export interface UseUnsavedDismissResult {
  /** Route every dismissal through this — it respects the dirty flag. */
  requestClose: () => void;
  /** True while the "discard unsaved changes?" prompt is showing. */
  showDismissWarning: boolean;
  /** Keep editing — hide the prompt, keep the overlay open. */
  cancelDismiss: () => void;
  /** Discard changes — hide the prompt and actually close. */
  confirmDismiss: () => void;
}

export function useUnsavedDismiss(options: {
  isDirty: boolean;
  /** When false every dismissal closes immediately (no warning). */
  warnOnDismiss: boolean;
  onClose: () => void;
}): UseUnsavedDismissResult {
  const { isDirty, warnOnDismiss, onClose } = options;
  const [showDismissWarning, setShowDismissWarning] = useState(false);

  const requestClose = useCallback(() => {
    if (warnOnDismiss && isDirty) {
      setShowDismissWarning(true);
      return;
    }
    onClose();
  }, [warnOnDismiss, isDirty, onClose]);

  const cancelDismiss = useCallback(() => setShowDismissWarning(false), []);

  const confirmDismiss = useCallback(() => {
    setShowDismissWarning(false);
    onClose();
  }, [onClose]);

  return { requestClose, showDismissWarning, cancelDismiss, confirmDismiss };
}
