// @vitest-environment happy-dom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityTable, type ColumnDef } from './entity-table';

interface Row { id: string; name: string }

const rows: Row[] = [
  { id: '1', name: 'الأول' },
  { id: '2', name: 'الثاني' },
];

const columns: ColumnDef<Row>[] = [
  { key: 'name', header: 'الاسم', render: (row) => row.name },
];

function tableProps(overrides: Partial<Parameters<typeof EntityTable<Row>>[0]> = {}) {
  return {
    'aria-label': 'جدول الاختبار',
    rows,
    columns,
    keyOf: (row: Row) => row.id,
    ...overrides,
  };
}

describe('EntityTable — حالات الجدول الموحد (markup)', () => {
  it('renders rows in a labelled table', () => {
    const html = renderToStaticMarkup(<EntityTable {...tableProps()} />);
    expect(html).toContain('aria-label="جدول الاختبار"');
    expect(html).toContain('الأول');
    expect(html).toContain('الثاني');
  });

  it('renders the shared empty state when there are no rows', () => {
    const html = renderToStaticMarkup(
      <EntityTable {...tableProps({ rows: [], emptyTitle: 'لا عناصر هنا', emptyDescription: 'أضف أول عنصر.' })} />,
    );
    expect(html).toContain('لا عناصر هنا');
    expect(html).toContain('أضف أول عنصر.');
  });

  it('renders the shared loading skeleton (no rows leak through)', () => {
    const html = renderToStaticMarkup(<EntityTable {...tableProps({ isLoading: true })} />);
    expect(html).not.toContain('الأول');
    expect(html).toContain('skeleton-shimmer');
  });

  it('renders the shared error state with a retry action', () => {
    const html = renderToStaticMarkup(
      <EntityTable {...tableProps({ error: new Error('boom'), errorTitle: 'فشل الجلب', onRetry: () => undefined })} />,
    );
    expect(html).toContain('فشل الجلب');
    expect(html).toContain('إعادة المحاولة');
  });

  it('renders mobile cards through renderMobileCard under role="list"', () => {
    const html = renderToStaticMarkup(
      <EntityTable {...tableProps({ renderMobileCard: (row: Row) => <div>بطاقة {row.name}</div> })} />,
    );
    expect(html).toContain('role="list" aria-label="جدول الاختبار"');
    expect(html).toContain('بطاقة الأول');
  });
});

describe('EntityTable — التفاعل', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('invokes onRetry from the error state', () => {
    const onRetry = vi.fn();
    act(() => {
      root.render(<EntityTable {...tableProps({ error: new Error('boom'), onRetry })} />);
    });
    const retryButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('إعادة المحاولة'));
    expect(retryButton).toBeDefined();
    act(() => {
      retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('invokes onPageChange from pagination controls', () => {
    const onPageChange = vi.fn();
    act(() => {
      root.render(
        <EntityTable
          {...tableProps({
            pagination: { page: 1, pageSize: 10, total: 30, onPageChange },
          })}
        />,
      );
    });
    const next = container.querySelector('button[aria-label="الصفحة التالية"]');
    expect(next).toBeTruthy();
    act(() => {
      next?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('invokes onRowClick with the clicked row', () => {
    const onRowClick = vi.fn();
    act(() => {
      root.render(<EntityTable {...tableProps({ onRowClick })} />);
    });
    const cell = Array.from(container.querySelectorAll('td')).find((td) => td.textContent === 'الأول');
    expect(cell).toBeTruthy();
    act(() => {
      cell?.closest('tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
