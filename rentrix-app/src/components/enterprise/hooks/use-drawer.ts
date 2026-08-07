/**
 * useDrawer — Enterprise UX Foundation (Wave 4A)
 *
 * State controller for EnterpriseDrawer. Tracks open/closed, which workflow
 * mode triggered it (create/edit/view/preview) and an opaque payload (the
 * entity being create/edit/view-ed). The hook never inspects the payload —
 * modules own the meaning, the hook owns the lifecycle.
 *
 * Pairs with the sticky-footer + unsaved-changes machinery inside
 * EnterpriseDrawer: report form dirtiness through `setDirty` and the drawer
 * will gate dismissal automatically.
 *
 * @example
 * const drawer = useDrawer<Contract>();
 * <Button onClick={() => drawer.openCreate()}>عقد جديد</Button>
 * <EnterpriseDrawer {...drawer.bind} mode={drawer.mode} … />
 */

import { useCallback, useMemo, useState } from 'react';

export const enterpriseDrawerModes = ['create', 'edit', 'view', 'preview'] as const;
export type EnterpriseDrawerMode = (typeof enterpriseDrawerModes)[number];

export interface UseDrawerResult<TPayload = unknown> {
  isOpen: boolean;
  mode: EnterpriseDrawerMode;
  payload: TPayload | null;
  /** True while the hosted form reports unsaved changes. */
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;

  open: (mode: EnterpriseDrawerMode, payload?: TPayload | null) => void;
  openCreate: (payload?: TPayload | null) => void;
  openEdit: (payload: TPayload) => void;
  openView: (payload: TPayload) => void;
  openPreview: (payload: TPayload) => void;
  /** Clears open state + dirty flag. Payload is kept until the drawer unmounts. */
  close: () => void;
  setPayload: (payload: TPayload | null) => void;

  /**
   * Spreadable bindings for EnterpriseDrawer:
   * `<EnterpriseDrawer {...drawer.bind} />`
   */
  bind: {
    open: boolean;
    mode: EnterpriseDrawerMode;
    isDirty: boolean;
    onOpenChange: (open: boolean) => void;
  };
}

export function useDrawer<TPayload = unknown>(
  defaultMode: EnterpriseDrawerMode = 'create',
): UseDrawerResult<TPayload> {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<EnterpriseDrawerMode>(defaultMode);
  const [payload, setPayload] = useState<TPayload | null>(null);
  const [isDirty, setDirty] = useState(false);

  const open = useCallback((nextMode: EnterpriseDrawerMode, nextPayload?: TPayload | null) => {
    setMode(nextMode);
    setPayload(nextPayload ?? null);
    setDirty(false);
    setIsOpen(true);
  }, []);

  const openCreate = useCallback(
    (nextPayload?: TPayload | null) => open('create', nextPayload),
    [open],
  );
  const openEdit = useCallback((nextPayload: TPayload) => open('edit', nextPayload), [open]);
  const openView = useCallback((nextPayload: TPayload) => open('view', nextPayload), [open]);
  const openPreview = useCallback((nextPayload: TPayload) => open('preview', nextPayload), [open]);

  const close = useCallback(() => {
    setIsOpen(false);
    setDirty(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) setIsOpen(true);
      else close();
    },
    [close],
  );

  const bind = useMemo(
    () => ({ open: isOpen, mode, isDirty, onOpenChange: handleOpenChange }),
    [isOpen, mode, isDirty, handleOpenChange],
  );

  return {
    isOpen,
    mode,
    payload,
    isDirty,
    setDirty,
    open,
    openCreate,
    openEdit,
    openView,
    openPreview,
    close,
    setPayload,
    bind,
  };
}
