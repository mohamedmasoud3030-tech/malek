// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomSheet, visualViewportOverlayStyle } from './bottom-sheet';

describe('BottomSheet mobile interaction contract', () => {
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
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    vi.restoreAllMocks();
  });

  it('portals to the document, tracks the visual viewport, locks scroll, and focuses the first form control', () => {
    expect(visualViewportOverlayStyle).toEqual({
      top: 'var(--visual-viewport-offset-top, 0px)',
      left: 'var(--visual-viewport-offset-left, 0px)',
      width: 'var(--visual-viewport-width, 100vw)',
      height: 'var(--visual-viewport-height, 100dvh)',
    });

    act(() => {
      root.render(
        <BottomSheet open onClose={vi.fn()} title="إضافة شخص">
          <input aria-label="الاسم" />
          <button type="button">حفظ</button>
        </BottomSheet>,
      );
    });

    const viewportRoot = document.body.querySelector<HTMLElement>('[data-bottom-sheet-root]');
    const sheet = document.body.querySelector('[data-bottom-sheet]');
    const scrollBody = document.body.querySelector('[data-bottom-sheet-scroll]');
    const input = document.body.querySelector<HTMLInputElement>('input[aria-label="الاسم"]');

    expect(viewportRoot).not.toBeNull();
    expect(sheet).not.toBeNull();
    expect(scrollBody).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(input);
  });

  it('exposes a tappable grab handle and honours reduced motion on its entrance animations', () => {
    act(() => {
      root.render(
        <BottomSheet open onClose={vi.fn()} title="إضافة شخص">
          <input aria-label="الاسم" />
        </BottomSheet>,
      );
    });

    const handle = document.body.querySelector<HTMLButtonElement>('[data-bottom-sheet-handle]');
    const backdrop = document.body.querySelector<HTMLButtonElement>('[data-bottom-sheet-root] > button');
    const panel = document.body.querySelector<HTMLElement>('[data-bottom-sheet]');

    expect(handle).not.toBeNull();
    expect(handle?.getAttribute('aria-label')).toBe('مقبض اللوحة — اضغط للإغلاق');
    expect(handle?.className).toContain('cursor-grab');
    expect(backdrop?.className).toContain('fade-in');
    expect(backdrop?.className).toContain('motion-reduce:animate-none');
    expect(panel?.className).toContain('motion-reduce:animate-none');
  });

  it('restores document scroll ownership after the sheet leaves the tree', () => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'clip';

    act(() => {
      root.render(
        <BottomSheet open onClose={vi.fn()} title="اختبار">
          <input aria-label="حقل" />
        </BottomSheet>,
      );
    });
    act(() => root.render(null));

    expect(document.body.style.overflow).toBe('auto');
    expect(document.documentElement.style.overflow).toBe('clip');
  });
});
