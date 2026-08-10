// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const backgroundState = vi.hoisted(() => ({ value: null as unknown }));
const navigateMock = vi.hoisted(() => vi.fn());
const closeSignals = vi.hoisted(() => ({ fn: null as null | (() => void) }));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ ownerId: 'owner-1' }),
  useNavigate: () => navigateMock,
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock('@/app/router/background-location', () => ({
  useBackgroundLocation: () => backgroundState.value,
}));

vi.mock('@/features/owners/useOwners', () => ({
  useOwner: () => ({ data: { id: 'owner-1', full_name: 'مالك تجريبي' }, isLoading: false }),
}));

vi.mock('@/features/owners/OwnersPage', () => ({
  OwnersWorkspace: () => <div data-testid="owners-workspace">سجل الملاك</div>,
}));

vi.mock('@/features/owners/owner-detail-page', () => ({
  OwnerDetailPage: () => <div data-testid="owner-detail-page">ملف المالك</div>,
}));

vi.mock('@/features/owners/components/owner-form-dialog', () => ({
  OwnerFormDialog: ({ open, onOpenChange, owner }: { open: boolean; onOpenChange: (open: boolean) => void; owner: { id?: string; full_name?: string } | null }) => {
    closeSignals.fn = () => onOpenChange(false);
    return (
      <div data-testid="owner-form-dialog" data-open={String(open)}>{owner?.full_name ?? 'بدون مالك'}</div>
    );
  },
}));

import { OwnerEditRouteComponent } from '@/routes/_protected.owners.$ownerId.edit';

describe('owner edit route — route-native context preservation', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    backgroundState.value = null;
    navigateMock.mockReset();
    closeSignals.fn = null;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function renderEdit() {
    act(() => {
      root.render(<OwnerEditRouteComponent />);
    });
  }

  it('edit from the owners register keeps the register behind the dialog; close goes back', () => {
    backgroundState.value = { pathname: '/owners' };
    renderEdit();
    expect(host.querySelector('[data-testid="owners-workspace"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="owner-detail-page"]')).toBeNull();
    expect(host.querySelector('[data-testid="owner-form-dialog"]')?.getAttribute('data-open')).toBe('true');
    expect(host.textContent).toContain('مالك تجريبي');

    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    act(() => { closeSignals.fn?.(); });
    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });

  it('edit from the full owner dossier renders the dossier behind the dialog; close goes back to it', () => {
    backgroundState.value = { pathname: '/owners/owner-1' };
    renderEdit();
    expect(host.querySelector('[data-testid="owner-detail-page"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="owners-workspace"]')).toBeNull();
    expect(host.querySelector('[data-testid="owner-form-dialog"]')?.getAttribute('data-open')).toBe('true');

    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    act(() => { closeSignals.fn?.(); });
    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });

  it('edit from the owner preview (nested background /owners) keeps the register context', () => {
    backgroundState.value = { pathname: '/owners' };
    renderEdit();
    expect(host.querySelector('[data-testid="owners-workspace"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="owner-detail-page"]')).toBeNull();
  });

  it('direct visit of the edit URL has a deterministic fallback: register behind, close navigates to the dossier', () => {
    backgroundState.value = null;
    renderEdit();
    expect(host.querySelector('[data-testid="owners-workspace"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="owner-form-dialog"]')?.getAttribute('data-open')).toBe('true');

    act(() => { closeSignals.fn?.(); });
    expect(navigateMock).toHaveBeenCalledWith({ to: '/owners/$ownerId', params: { ownerId: 'owner-1' } });
  });
});