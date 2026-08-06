// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// React 19 requires an explicit act-capable test environment.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { ListItemCard, MobileCard } from './mobile-card';

describe('Visual Wave 1 — mobile entity-card RTL and keyboard contract', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('uses an inline-start accent rather than a physical left border in RTL', () => {
    act(() => {
      root.render(<MobileCard title="طلب صيانة" accent="danger" />);
    });

    const card = host.querySelector<HTMLElement>('.border-s-4');
    expect(card).not.toBeNull();
    expect(card?.className).toContain('border-s-danger');
    expect(card?.className).not.toContain('border-l-danger');
  });

  it('keeps an interactive card primary action separate from its secondary buttons', () => {
    act(() => {
      root.render(
        <MobileCard
          title="عقار الواحة"
          onClick={() => undefined}
          actions={<button type="button">تعديل</button>}
        />,
      );
    });

    const primary = host.querySelector<HTMLElement>('[data-mobile-card-primary]');
    const action = host.querySelector<HTMLButtonElement>('[data-mobile-card] > div button');
    expect(primary?.getAttribute('role')).toBe('button');
    expect(primary?.contains(action ?? null)).toBe(false);
  });

  it('does not activate a list-card parent when a nested action receives Enter', () => {
    const onCardClick = vi.fn();
    const onNestedClick = vi.fn();

    act(() => {
      root.render(
        <ListItemCard
          title="عقار الواحة"
          onClick={onCardClick}
          rightElement={<button type="button" onClick={onNestedClick}>إجراء</button>}
        />,
      );
    });

    const nestedAction = host.querySelector<HTMLButtonElement>('button');
    act(() => {
      nestedAction?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onCardClick).not.toHaveBeenCalled();
  });
});
