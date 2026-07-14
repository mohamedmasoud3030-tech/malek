// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './bottom-sheet';

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

  it('portals to the document, locks background scroll, and focuses the first form control', () => {
    act(() => {
      root.render(
        <BottomSheet open onClose={vi.fn()} title="إضافة شخص">
          <input aria-label="الاسم" />
          <button type="button">حفظ</button>
        </BottomSheet>,
      );
    });

    const sheet = document.body.querySelector('[data-bottom-sheet]');
    const scrollBody = document.body.querySelector('[data-bottom-sheet-scroll]');
    const input = document.body.querySelector<HTMLInputElement>('input[aria-label="الاسم"]');

    expect(sheet).not.toBeNull();
    expect(scrollBody).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(input);
  });

  it('restores document scroll ownership after unmount', () => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'clip';

    act(() => {
      root.render(
        <BottomSheet open onClose={vi.fn()} title="اختبار">
          <input aria-label="حقل" />
        </BottomSheet>,
      );
    });
    act(() => root.unmount());

    expect(document.body.style.overflow).toBe('auto');
    expect(document.documentElement.style.overflow).toBe('clip');
  });
});