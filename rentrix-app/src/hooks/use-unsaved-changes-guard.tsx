import { useBlocker } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * Mounts a `beforeunload` listener only while `isDirty` is true, and removes
 * it as soon as the form becomes clean (after a successful save or an
 * explicit discard). Browsers ignore the custom message and show their own
 * generic prompt, which is intentional — we don't try to invent a custom
 * UI that the browser API doesn't support.
 *
 * Safe on SSR: returns early when `window` is undefined.
 */
export function useBeforeUnloadGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return undefined;
    if (typeof window === 'undefined') return undefined;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required for legacy browsers; ignored by modern ones.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}

type SubmitGuardResult = Readonly<{
  busy: boolean;
  /**
   * Runs `task` while guaranteeing no re-entrancy: a second `run` call
   * issued while the first one is still pending returns `undefined`
   * instead of starting a new submission. This guards both the submit
   * handler and the submit button against a rapid second tap / click /
   * Enter-key submission.
   */
  run: <T>(task: () => Promise<T>) => Promise<T | undefined>;
}>;

/**
 * Returns `{ busy, run }` for the calling component. Wrap the actual
 * submit handler in `run(async () => ...)` to make it re-entrancy-safe.
 *
 * Intentionally minimal — it does not handle validation, error display,
 * toast messages, or navigation. Those stay in the consumer so this hook
 * can be shared by every form without coupling to specific paths or copy.
 */
export function useSubmitGuard(): SubmitGuardResult {
  const [busy, setBusy] = useState(false);
  // We intentionally use a ref for the in-flight flag so that a render
  // batch produced by `setBusy` cannot leave a window where a second
  // `run` call sees `busy === false` while the first call is still
  // pending.
  const inFlightRef = useRef(false);

  const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T | undefined> => {
    if (inFlightRef.current) return undefined;
    inFlightRef.current = true;
    setBusy(true);
    try {
      return await task();
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}


type DirtyRouteNavigationGuardProps = Readonly<{
  isDirty: boolean;
  disabled?: boolean;
  onDiscard?: () => void;
}>;

/**
 * Blocks in-app TanStack Router navigation while a meaningful form is dirty.
 * Uses the router's official blocker resolver instead of patching browser
 * history, and leaves hard browser/tab close prompts to `useBeforeUnloadGuard`.
 */
export function DirtyRouteNavigationGuard({
  isDirty,
  disabled = false,
  onDiscard,
}: DirtyRouteNavigationGuardProps) {
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => current.pathname !== next.pathname && isDirty,
    enableBeforeUnload: false,
    disabled: disabled || !isDirty,
    withResolver: true,
  });

  const handleContinueEditing = () => {
    if (blocker.status === 'blocked') {
      blocker.reset();
    }
  };

  const handleDiscardChanges = () => {
    if (blocker.status !== 'blocked') return;
    onDiscard?.();
    blocker.proceed();
  };

  return (
    <ConfirmDialog
      open={blocker.status === 'blocked'}
      onOpenChange={(open) => { if (!open) handleContinueEditing(); }}
      title="تغييرات غير محفوظة"
      description="هناك تغييرات لم تحفظ. إذا غادرت الآن سوف تفقد هذه التغييرات."
      confirmLabel="تجاهل التغييرات"
      cancelLabel="مواصلة التعديل"
      variant="warning"
      onConfirm={handleDiscardChanges}
    />
  );
}
