// @vitest-environment happy-dom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityTable, type ColumnDef } from './entity-table';

interface Row { id: string; name: string }
const rows: Row[] = [{ id: '1', name: 'أحمد الطويل جداً' }, { id: '2', name: 'الثاني' }];
const columns: ColumnDef<Row>[] = [
  { key: 'name', header: 'الاسم', priority: 'identity', render: (row) => row.name },
  { key: 'amount', header: 'المبلغ', priority: 'primary', render: (row) => `${row.name} مبلغ` },
  { key: 'actions', header: 'إجراءات', priority: 'actions', render: () => <button type="button">إجراء</button> },
];
const props = (overrides: Partial<Parameters<typeof EntityTable<Row>>[0]> = {}) => ({ 'aria-label': 'جدول الاختبار', rows, columns, keyOf: (row: Row) => row.id, ...overrides });

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

describe('EntityTable — responsive desktop/tablet table and phone row cards', () => {
  beforeEach(() => {
    setViewportWidth(1280);
  });

  afterEach(() => {
    setViewportWidth(1280);
  });

  it('renders the semantic table on desktop and shared row cards on phone', () => {
    const table = renderToStaticMarkup(<EntityTable {...props()} />);
    expect(table).toContain('<table');
    expect(table).toContain('data-entity-table-scroll');
    expect(table).toContain('mobile-scroll-x');
    expect(table).toContain('xl:sticky xl:start-0');
    expect(table).toContain('xl:sticky xl:end-0');

    setViewportWidth(375);
    const cards = renderToStaticMarkup(<EntityTable {...props()} />);
    expect(cards).toContain('data-entity-table-mobile-list');
    expect(cards).toContain('data-entity-table-mobile-card');
    expect(cards).toContain('data-entity-card');
    expect(cards).toContain('data-entity-table-mobile-primary');
  });

  it('selects the highest-priority primary datum for mobile supporting text when a table does not opt in explicitly', () => {
    setViewportWidth(375);
    const html = renderToStaticMarkup(<EntityTable {...props()} />);
    expect(html).toContain('data-entity-table-mobile-supporting');
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
    setViewportWidth(375);
    const loading = renderToStaticMarkup(<EntityTable {...props({ isLoading: true })} />);
    expect(loading).toContain('data-entity-table-mobile-skeleton');
    expect(loading).not.toContain('أحمد الطويل جداً');

    const empty = renderToStaticMarkup(<EntityTable {...props({ rows: [], emptyTitle: 'لا توجد نتائج' })} />);
    expect(empty).toContain('لا توجد نتائج');

    const initialError = renderToStaticMarkup(<EntityTable {...props({ rows: [], error: new Error('boom'), errorTitle: 'تعذر التحميل', onRetry: () => undefined })} />);
    expect(initialError).toContain('role="alert"');
    expect(initialError).toContain('تعذر التحميل');
    expect(initialError).toContain('إعادة المحاولة');

    const staleError = renderToStaticMarkup(<EntityTable {...props({ error: new Error('boom'), errorTitle: 'تعذر التحميل', onRetry: () => undefined })} />);
    expect(staleError).toContain('تعذر التحميل');
    expect(staleError).toContain('الصفوف المعروضة من آخر تحميل مكتمل');
    expect(staleError).toContain('data-stale-register-content="true"');
    expect(staleError).toContain('inert=""');
    expect(staleError).toContain('أحمد الطويل جداً');
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

  it('keeps one table on tablet but removes lower-priority detail columns', () => {
    setViewportWidth(820);
    const tabletColumns: ColumnDef<Row>[] = [
      { key: 'name', header: 'الاسم', priority: 'identity', render: (row) => row.name },
      { key: 'status', header: 'الحالة', priority: 'primary', render: () => 'نشط' },
      { key: 'secondary-a', header: 'ثانوي أ', priority: 'secondary', render: () => 'أ' },
      { key: 'secondary-b', header: 'ثانوي ب', priority: 'secondary', render: () => 'ب' },
      { key: 'detail', header: 'تفصيل', priority: 'detail', render: () => 'تفصيل طويل' },
      { key: 'actions', header: 'إجراءات', priority: 'actions', render: () => <button type="button">إجراء</button> },
    ];
    const html = renderToStaticMarkup(<EntityTable {...props({ columns: tabletColumns })} />);
    expect(html).toContain('<table');
    expect(html).toContain('ثانوي أ');
    expect(html).not.toContain('تفصيل طويل');
  });

  it('keeps a tappable card body plus a fallback more-actions disclosure on phone', () => {
    let container: HTMLDivElement;
    const root = createRoot((container = document.createElement('div')));
    document.body.appendChild(container);
    const onRowClick = vi.fn();
    setViewportWidth(375);
    act(() => root.render(<EntityTable {...props({ onRowClick })} />));

    const detail = container.querySelector<HTMLButtonElement>('[data-entity-card-primary]');
    expect(detail).toBeDefined();
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
