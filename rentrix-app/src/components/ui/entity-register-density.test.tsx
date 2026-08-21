// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTableColumnsMenu } from './data-table-columns-menu';
import { EntitySummaryStrip } from './entity-summary-strip';
import { FilterBar } from './filter-bar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('entity register density primitives', () => {
  it('keeps summary data in one semantic strip without metric-card chrome', () => {
    const html = renderToStaticMarkup(
      <EntitySummaryStrip
        ariaLabel="ملخص السجل"
        items={[
          { label: 'النتائج', value: 12 },
          { label: 'تحتاج متابعة', value: 2, tone: 'warning' },
        ]}
      />,
    );

    expect(html).toContain('<dl');
    expect(html).toContain('data-entity-summary-strip');
    expect(html).toContain('ملخص السجل');
    expect(html).not.toContain('data-kpi-card');
    expect(html).not.toContain('shadow-card');
  });

  it('keeps the desktop column selector out of the phone toolbar', () => {
    const html = renderToStaticMarkup(
      <DataTableColumnsMenu
        columns={[{ key: 'name', label: 'الاسم', locked: true }]}
        visibleKeys={['name']}
        onChange={() => undefined}
      />,
    );
    expect(html).toContain('data-table-columns-menu');
    expect(html).toContain('hidden md:block');
  });

  describe('mobile filter sheet', () => {
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
      document.body.innerHTML = '';
    });

    it('keeps one toolbar trigger and moves labelled filters into a bottom sheet', () => {
      const onSearchChange = vi.fn();
      act(() => {
        root.render(
          <FilterBar
            searchValue=""
            onSearchChange={onSearchChange}
            mobileFilterCount={1}
            filters={(
              <label>
                <span>الحالة</span>
                <select aria-label="الحالة"><option>الكل</option></select>
              </label>
            )}
          />,
        );
      });

      const trigger = host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
      expect(trigger?.getAttribute('aria-label')).toContain('1 مفعلة');
      expect(document.querySelector('[data-mobile-filter-sheet]')).toBeNull();

      act(() => trigger?.click());
      expect(document.querySelector('[data-mobile-filter-sheet]')?.textContent).toContain('الحالة');
      expect(document.body.style.overflow).toBe('hidden');

      act(() => document.querySelector<HTMLButtonElement>('[data-mobile-filter-sheet] button')?.click());
      expect(document.querySelector('[data-mobile-filter-sheet]')).toBeNull();
    });
  });
});
