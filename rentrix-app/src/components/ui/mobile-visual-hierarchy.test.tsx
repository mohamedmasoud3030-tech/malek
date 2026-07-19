// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityCard } from './entity-card';
import { FilterTabs } from './filter-tabs';

describe('mobile visual hierarchy contract', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('keeps filter selection semantic and exposes real horizontal overflow', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        <FilterTabs
          options={[
            { value: 'all', label: 'الكل' },
            { value: 'active', label: 'نشط', count: 12 },
            { value: 'expired', label: 'منتهي' },
          ]}
          value="active"
          onChange={onChange}
        />,
      );
    });

    const wrapper = host.querySelector<HTMLElement>('[data-filter-tabs-wrapper]');
    const scroller = host.querySelector<HTMLElement>('[data-filter-tabs-scroll]');
    const activeButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('نشط'));
    const expiredButton = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes('منتهي'));

    expect(wrapper).not.toBeNull();
    expect(scroller).not.toBeNull();
    expect(activeButton?.getAttribute('aria-pressed')).toBe('true');

    Object.defineProperty(scroller!, 'scrollWidth', { configurable: true, value: 420 });
    Object.defineProperty(scroller!, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(scroller!, 'scrollLeft', { configurable: true, value: 0, writable: true });

    act(() => scroller!.dispatchEvent(new Event('scroll')));
    expect(wrapper?.dataset.canScrollStart).toBe('false');
    expect(wrapper?.dataset.canScrollEnd).toBe('true');

    scroller!.scrollLeft = -120;
    act(() => scroller!.dispatchEvent(new Event('scroll')));
    expect(wrapper?.dataset.canScrollStart).toBe('true');
    expect(wrapper?.dataset.canScrollEnd).toBe('true');

    act(() => expiredButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onChange).toHaveBeenCalledWith('expired');
  });

  it('orders card content by importance and keeps multiple actions compact', () => {
    const cardClick = vi.fn();
    const primaryAction = vi.fn();

    act(() => {
      root.render(
        <EntityCard
          id="owner-1"
          name="محمد سالم"
          type="owner"
          stats={<span>1,250 ر.ع</span>}
          meta={[{ label: 'الهاتف', value: '90000000' }]}
          actions={[
            { label: 'فتح', variant: 'default', onClick: primaryAction },
            { label: 'تعديل', onClick: vi.fn() },
          ]}
          onClick={cardClick}
        />,
      );
    });

    const card = host.querySelector<HTMLElement>('[data-entity-card]');
    const stats = Array.from(host.querySelectorAll('span')).find((node) => node.textContent === '1,250 ر.ع');
    const meta = Array.from(host.querySelectorAll('span')).find((node) => node.textContent === '90000000');
    const actionButtons = Array.from(host.querySelectorAll('button'));
    const actionsContainer = actionButtons[0]?.parentElement;

    expect(card).not.toBeNull();
    expect(stats).toBeDefined();
    expect(meta).toBeDefined();
    expect(Boolean(stats!.compareDocumentPosition(meta!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(actionsContainer?.classList.contains('grid-cols-2')).toBe(true);

    act(() => actionButtons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(primaryAction).toHaveBeenCalledOnce();
    expect(cardClick).not.toHaveBeenCalled();
  });
});
