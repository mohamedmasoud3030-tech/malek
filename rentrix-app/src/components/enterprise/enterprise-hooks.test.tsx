// @vitest-environment happy-dom
/**
 * Enterprise hooks — Wave 4A targeted tests.
 *
 * Covers the five foundation hooks: useDrawer, useTableState, useFilters,
 * usePersistentTableState and useKeyboardShortcuts, plus the shared
 * useUnsavedDismiss gate. Pure state machinery — no module logic.
 */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { useDrawer } from './hooks/use-drawer';
import { useFilters } from './hooks/use-filters';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { usePersistentTableState } from './hooks/use-persistent-table-state';
import { useTableState } from './hooks/use-table-state';
import { useUnsavedDismiss } from './hooks/use-unsaved-dismiss';
import { EnterpriseStickyFooter } from './enterprise-sticky-footer';

afterEach(() => {
  cleanup();
});

describe('useTableState', () => {
  it('cycles sort asc → desc → cleared', () => {
    const { result } = renderHook(() => useTableState());
    act(() => result.current.toggleSort('name'));
    expect(result.current.sort).toEqual({ field: 'name', direction: 'asc' });
    act(() => result.current.toggleSort('name'));
    expect(result.current.sort).toEqual({ field: 'name', direction: 'desc' });
    act(() => result.current.toggleSort('name'));
    expect(result.current.sort).toBeNull();
  });

  it('resets the page when search or page size change', () => {
    const { result } = renderHook(() => useTableState({ pageSize: 10 }));
    act(() => result.current.setPage(4));
    expect(result.current.page).toBe(4);

    act(() => result.current.setSearch('عقد'));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(3));
    act(() => result.current.setPageSize(50));
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(50);
  });

  it('tracks selection as a set with toggle helpers', () => {
    const { result } = renderHook(() => useTableState());
    act(() => result.current.toggleSelected('a'));
    act(() => result.current.toggleSelected('b'));
    expect(result.current.selectionCount).toBe(2);
    expect(result.current.isSelected('a')).toBe(true);

    act(() => result.current.toggleSelected('a'));
    expect(result.current.isSelected('a')).toBe(false);

    act(() => result.current.setSelectedKeys(['x', 'y', 'z']));
    expect(result.current.selectionCount).toBe(3);

    act(() => result.current.clearSelection());
    expect(result.current.selectionCount).toBe(0);
  });

  it('resets everything back to defaults', () => {
    const { result } = renderHook(() => useTableState({ defaultSort: { field: 'code', direction: 'asc' } }));
    act(() => result.current.setPage(3));
    act(() => result.current.setSearch('x'));
    act(() => result.current.toggleSelected('1'));
    act(() => result.current.reset());
    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe('');
    expect(result.current.selectionCount).toBe(0);
    expect(result.current.sort).toEqual({ field: 'code', direction: 'asc' });
  });
});

describe('useFilters', () => {
  it('counts only non-empty active values', () => {
    const { result } = renderHook(() => useFilters({ status: '', owner: '', city: 'صلالة' }));
    expect(result.current.activeCount).toBe(1);

    act(() => result.current.setValue('status', 'active'));
    expect(result.current.activeCount).toBe(2);
    expect(result.current.values.status).toBe('active');
  });

  it('clears individual filters and the whole set', () => {
    const { result } = renderHook(() => useFilters({ status: '', owner: '' }));
    act(() => result.current.setMany({ status: 'late', owner: '42' }));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.clearValue('status'));
    expect(result.current.values.status).toBe('');
    expect(result.current.values.owner).toBe('42');

    act(() => result.current.clearAll());
    expect(result.current.isDirty).toBe(false);
  });
});

describe('useDrawer', () => {
  it('opens in each mode with a payload and closes cleanly', () => {
    const { result } = renderHook(() => useDrawer<{ id: string }>());

    act(() => result.current.openEdit({ id: '9' }));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.mode).toBe('edit');
    expect(result.current.payload).toEqual({ id: '9' });

    act(() => result.current.setDirty(true));
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });

  it('provides spreadable bind props for EnterpriseDrawer', () => {
    const { result } = renderHook(() => useDrawer());
    act(() => result.current.openCreate());
    expect(result.current.bind.open).toBe(true);
    expect(result.current.bind.mode).toBe('create');

    act(() => result.current.bind.onOpenChange(false));
    expect(result.current.bind.open).toBe(false);
  });
});

describe('useKeyboardShortcuts', () => {
  function Harness({ onFire, keys }: { onFire: () => void; keys: string }) {
    useKeyboardShortcuts([{ keys, description: 'اختبار', onTrigger: onFire }]);
    return null;
  }

  it('fires on a mod chord', () => {
    const onFire = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Harness onFire={onFire} keys="mod+k" />));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    });
    expect(onFire).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('ignores plain keys typed inside editable fields', () => {
    const onFire = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <div>
          <Harness onFire={onFire} keys="/" />
          <input data-testid="field" />
        </div>,
      ),
    );

    const input = container.querySelector('input')!;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });
    expect(onFire).not.toHaveBeenCalled();

    act(() => {
      container.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    });
    expect(onFire).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });

  it('stops firing after unmount', () => {
    const onFire = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<Harness onFire={onFire} keys="escape" />));
    act(() => root.unmount());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onFire).not.toHaveBeenCalled();
    container.remove();
  });
});

describe('usePersistentTableState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists page/sort/search under the storage key and hydrates back', () => {
    const { result, unmount } = renderHook(() =>
      usePersistentTableState('enterprise:test-table', { pageSize: 10 }),
    );
    // Search resets the page by design, so set it before navigating.
    act(() => result.current.setSearch('بحث'));
    act(() => result.current.setPage(2));
    act(() => result.current.toggleSort('name'));
    unmount();

    const raw = window.localStorage.getItem('enterprise:test-table');
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { page: number; search: string; sort: { field: string } };
    expect(saved.page).toBe(2);
    expect(saved.search).toBe('بحث');
    expect(saved.sort.field).toBe('name');

    const { result: hydrated } = renderHook(() =>
      usePersistentTableState('enterprise:test-table', { pageSize: 10 }),
    );
    expect(hydrated.current.search).toBe('بحث');
    expect(hydrated.current.sort).toEqual({ field: 'name', direction: 'asc' });
    expect(hydrated.current.page).toBe(2);
  });

  it('does not persist selection', () => {
    const { result, unmount } = renderHook(() =>
      usePersistentTableState('enterprise:test-selection'),
    );
    act(() => result.current.toggleSelected('1'));
    unmount();

    const raw = window.localStorage.getItem('enterprise:test-selection');
    expect(raw).not.toContain('selected');
    expect(raw).not.toContain('selection');
  });
});

describe('useUnsavedDismiss', () => {
  it('routes dismissal through the warning when dirty', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedDismiss({ isDirty: true, warnOnDismiss: true, onClose }),
    );

    act(() => result.current.requestClose());
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.showDismissWarning).toBe(true);

    act(() => result.current.cancelDismiss());
    expect(result.current.showDismissWarning).toBe(false);

    act(() => result.current.requestClose());
    act(() => result.current.confirmDismiss());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes immediately when clean', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedDismiss({ isDirty: false, warnOnDismiss: true, onClose }),
    );
    act(() => result.current.requestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('EnterpriseStickyFooter', () => {
  it('renders children with sticky positioning and safe-area padding', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <EnterpriseStickyFooter>
          <button type="button">حفظ</button>
        </EnterpriseStickyFooter>,
      ),
    );

    const footer = container.querySelector('[data-enterprise-sticky-footer]')!;
    expect(footer.className).toContain('sticky');
    expect(footer.className).toContain('bottom-0');
    expect(container.textContent).toContain('حفظ');
    act(() => root.unmount());
    container.remove();
  });
});
