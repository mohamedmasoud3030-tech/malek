// @vitest-environment happy-dom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityTable, type ColumnDef } from './entity-table';

interface Row { id: string; name: string }
const rows: Row[] = [{ id: '1', name: 'أحمد الطويل جداً' }, { id: '2', name: 'الثاني' }];
const columns: ColumnDef<Row>[] = [
  { key: 'name', header: 'الاسم', priority: 'identity', render: (row) => row.name },
  { key: 'amount', header: 'المبلغ', priority: 'primary', render: (row) => `${row.name} مبلغ` },
  { key: 'actions', header: 'إجراءات', priority: 'actions', render: () => <button type="button">إجراء</button> },
];
const props = (overrides: Partial<Parameters<typeof EntityTable<Row>>[0]> = {}) => ({ 'aria-label': 'جدول الاختبار', rows, columns, keyOf: (row: Row) => row.id, ...overrides });

describe('EntityTable — desktop table + mobile canonical EntityCard register', () => {
  beforeEach(() => {
    window.localStorage.removeItem('malek:entity-register:view-mode');
  });

  it('renders the dense semantic table for desktop and shared EntityCards for the cards view', () => {
    // Default presentation: the dense semantic table.
    const table = renderToStaticMarkup(<EntityTable {...props()} />);
    expect(table).toContain('<table');
    expect(table).toContain('data-entity-table-scroll');
    expect(table).toContain('sticky start-0');
    expect(table).toContain('sticky end-0');

    // Explicit Cards presentation: the shared canonical EntityCard list.
    window.localStorage.setItem('malek:entity-register:view-mode', 'cards');
    const cards = renderToStaticMarkup(<EntityTable {...props()} />);
    expect(cards).toContain('data-entity-table-mobile-list');
    expect(cards).toContain('data-entity-table-mobile-card');
    expect(cards).toContain('data-entity-card');
    expect(cards).toContain('data-entity-table-mobile-datum');
  });

  it('selects the highest-priority primary datum for mobile cards', () => {
    window.localStorage.setItem('malek:entity-register:view-mode', 'cards');
    const html = renderToStaticMarkup(<EntityTable {...props()} />);
    expect(html).toContain('المبلغ');
    expect(html).toContain('أحمد الطويل جداً مبلغ');
  });

  it('does not nest rich identity or supporting content inside paragraphs', () => {
    const richColumns: ColumnDef<Row>[] = [
      { key: 'name', header: 'الاسم', priority: 'identity', render: (row) => <div><p>{row.name}</p></div> },
      { key: 'amount', header: <span>المبلغ</span>, priority: 'primary', render: (row) => `${row.name} مبلغ` },
    ];
    const html = renderToStaticMarkup(<EntityTable {...props({ columns: richColumns })} />);
    expect(html).not.toMatch(/<p[^>]*>\s*<div/);
    expect(html).not.toMatch(/<p[^>]*>\s*<span/);
  });

  it('renders shared mobile loading cards and shared empty/error states', () => {
    window.localStorage.setItem('malek:entity-register:view-mode', 'cards');
    const loading = renderToStaticMarkup(<EntityTable {...props({ isLoading: true })} />);
    expect(loading).toContain('data-entity-table-mobile-skeleton');
    expect(loading).not.toContain('أحمد الطويل جداً');

    const empty = renderToStaticMarkup(<EntityTable {...props({ rows: [], emptyTitle: 'لا توجد نتائج' })} />);
    expect(empty).toContain('لا توجد نتائج');

    const error = renderToStaticMarkup(<EntityTable {...props({ error: new Error('boom'), errorTitle: 'تعذر التحميل', onRetry: () => undefined })} />);
    expect(error).toContain('تعذر التحميل');
    expect(error).toContain('إعادة المحاولة');
  });

  it('does not render pagination for a single page', () => {
    const html = renderToStaticMarkup(<EntityTable {...props({ pagination: { page: 1, pageSize: 10, total: 2, onPageChange: () => undefined } })} />);
    expect(html).not.toContain('ترقيم الصفحات');
  });

  it('supports pagination and desktop row activation', () => {
    let container: HTMLDivElement;
    const root = createRoot((container = document.createElement('div')));
    document.body.appendChild(container);
    const onPageChange = vi.fn();
    const onRowClick = vi.fn();
    act(() => root.render(<EntityTable {...props({ pagination: { page: 1, pageSize: 1, total: 2, onPageChange }, onRowClick })} />));
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="الصفحة التالية"]')?.click());
    expect(onPageChange).toHaveBeenCalledWith(2);
    act(() => container.querySelector<HTMLTableRowElement>('tbody tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    act(() => root.unmount());
    container.remove();
  });

  it('exposes a >=44px mobile detail action and the existing row actions disclosure', () => {
    let container: HTMLDivElement;
    const root = createRoot((container = document.createElement('div')));
    document.body.appendChild(container);
    const onRowClick = vi.fn();
    window.localStorage.setItem('malek:entity-register:view-mode', 'cards');
    act(() => root.render(<EntityTable {...props({ onRowClick })} />));

    const detail = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-entity-table-mobile-card] button'))
      .find((button) => button.textContent?.includes('فتح التفاصيل'));
    expect(detail).toBeDefined();
    expect(detail?.className).toContain('min-h-11');
    act(() => detail?.click());
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    const actions = container.querySelector<HTMLButtonElement>('[data-entity-table-mobile-actions]');
    expect(actions).not.toBeNull();
    expect(actions?.className).toContain('min-h-11');
    act(() => actions?.click());
    expect(container.querySelector('[data-entity-table-mobile-actions-panel]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
