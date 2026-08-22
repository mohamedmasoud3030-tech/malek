// @vitest-environment happy-dom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EntityTable, type ColumnDef } from './entity-table';

interface Row { id: string; name: string }
const rows: Row[] = [{ id: '1', name: 'أحمد الطويل جداً' }, { id: '2', name: 'الثاني' }];
const columns: ColumnDef<Row>[] = [
  { key: 'name', header: 'الاسم', priority: 'identity', render: (row) => row.name },
  { key: 'amount', header: 'المبلغ', priority: 'primary', render: (row) => `${row.name} مبلغ` },
  { key: 'actions', header: 'إجراءات', priority: 'actions', render: () => <button type="button">إجراء</button> },
];
const props = (overrides: Partial<Parameters<typeof EntityTable<Row>>[0]> = {}) => ({ 'aria-label': 'جدول الاختبار', rows, columns, keyOf: (row: Row) => row.id, ...overrides });

describe('EntityTable — one semantic register at every viewport', () => {
  it('renders only the semantic table inside a horizontal scroll region, with sticky identity and actions', () => {
    const html = renderToStaticMarkup(<EntityTable {...props()} />);
    expect(html).toContain('<table');
    expect(html).toContain('data-entity-table-scroll');
    expect(html).toContain('mobile-scroll-x');
    expect(html).toContain('sticky start-0');
    expect(html).toContain('sticky end-0');
    expect(html).not.toContain('data-entity-table-mobile-card');
    expect(html).not.toContain('data-entity-table-mobile-list');
  });

  it('does not render pagination for a single page', () => {
    const html = renderToStaticMarkup(<EntityTable {...props({ pagination: { page: 1, pageSize: 10, total: 2, onPageChange: () => undefined } })} />);
    expect(html).not.toContain('ترقيم الصفحات');
  });

  it('supports pagination, row activation, and nested action safety in the same table', () => {
    let container: HTMLDivElement;
    const root = createRoot((container = document.createElement('div')));
    document.body.appendChild(container);
    const onPageChange = vi.fn(); const onRowClick = vi.fn();
    act(() => root.render(<EntityTable {...props({ pagination: { page: 1, pageSize: 1, total: 2, onPageChange }, onRowClick })} />));
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="الصفحة التالية"]')?.click());
    expect(onPageChange).toHaveBeenCalledWith(2);
    act(() => container.querySelector<HTMLTableRowElement>('tbody tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    act(() => root.unmount()); container.remove();
  });
});
