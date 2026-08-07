// @vitest-environment happy-dom
/**
 * EnterpriseDataTable — Wave 4A targeted component tests.
 *
 * Verifies the table framework contract: state gates, sorting announcement,
 * client sorting/filtering, selection, pagination, sticky affordances,
 * responsive card mode and keyboard traversal. No module logic involved.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EnterpriseDataTable,
  type EnterpriseColumnDef,
} from './enterprise-data-table';
import type { EnterpriseSortState } from './hooks/use-table-state';

afterEach(() => {
  cleanup();
});

interface Row {
  id: string;
  name: string;
  amount: number;
}

const rows: Row[] = [
  { id: '1', name: 'ألف', amount: 30 },
  { id: '2', name: 'باء', amount: 10 },
  { id: '3', name: 'جيم', amount: 20 },
  { id: '4', name: 'دال', amount: 40 },
];

const columns: EnterpriseColumnDef<Row>[] = [
  {
    key: 'name',
    header: 'الاسم',
    sortable: true,
    sortValue: (row) => row.name,
    cell: (row) => row.name,
  },
  {
    key: 'amount',
    header: 'المبلغ',
    sortable: true,
    sortValue: (row) => row.amount,
    cell: (row) => row.amount,
  },
  { key: 'plain', header: 'ثابت', cell: () => '—' },
];

function renderTable(overrides: Partial<Parameters<typeof EnterpriseDataTable<Row>>[0]> = {}) {
  return render(
    <EnterpriseDataTable
      rows={rows}
      columns={columns}
      keyOf={(row) => row.id}
      aria-label="جدول اختبار"
      {...overrides}
    />,
  );
}

describe('EnterpriseDataTable — state gates', () => {
  it('renders the loading skeleton with a polite status role', () => {
    renderTable({ isLoading: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(document.querySelector('[data-enterprise-data-table]')?.getAttribute('data-state')).toBe('loading');
  });

  it('renders the error surface with retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderTable({ error: new Error('boom'), onRetry });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the empty state when there are no rows', () => {
    renderTable({ rows: [], emptyTitle: 'فارغ تمامًا' });
    expect(screen.getByText('فارغ تمامًا')).toBeInTheDocument();
    expect(document.querySelector('[data-enterprise-data-table]')?.getAttribute('data-state')).toBe('empty');
  });

  it('renders rows and headers in the ready state', () => {
    renderTable();
    const table = screen.getByRole('table', { name: 'جدول اختبار' });
    expect(table).toBeInTheDocument();
    expect(within(table).getByText('ألف')).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(rows.length + 1);
  });
});

describe('EnterpriseDataTable — sorting', () => {
  it('announces asc → desc → clear through onSortChange', async () => {
    const user = userEvent.setup();
    const calls: Array<EnterpriseSortState | null> = [];
    let current: EnterpriseSortState | null = null;
    const { rerender } = render(
      <EnterpriseDataTable
        rows={rows}
        columns={columns}
        keyOf={(row) => row.id}
        aria-label="جدول اختبار"
        sort={current}
        onSortChange={(next) => {
          calls.push(next);
          current = next;
        }}
      />,
    );

    const sortButton = screen.getByRole('button', { name: 'ترتيب حسب الاسم' });
    await user.click(sortButton);
    expect(calls[0]).toEqual({ field: 'name', direction: 'asc' });

    // Simulate the controlled parent honoring the announced state.
    rerender(
      <EnterpriseDataTable
        rows={rows}
        columns={columns}
        keyOf={(row) => row.id}
        aria-label="جدول اختبار"
        sort={current}
        onSortChange={(next) => {
          calls.push(next);
          current = next;
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'ترتيب حسب الاسم' }));
    expect(calls[1]).toEqual({ field: 'name', direction: 'desc' });

    rerender(
      <EnterpriseDataTable
        rows={rows}
        columns={columns}
        keyOf={(row) => row.id}
        aria-label="جدول اختبار"
        sort={current}
        onSortChange={(next) => {
          calls.push(next);
          current = next;
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'ترتيب حسب الاسم' }));
    expect(calls[2]).toBeNull();
  });

  it('sorts client-side via sortValue when sortMode="client"', () => {
    renderTable({ sortMode: 'client', defaultSort: { field: 'amount', direction: 'asc' } });
    const cells = screen.getAllByRole('row').slice(1); // skip header
    const amounts = cells.map((row) => Number(within(row).getAllByRole('cell')[1].textContent));
    expect(amounts).toEqual([10, 20, 30, 40]);
  });

  it('marks the active sort header with aria-sort', () => {
    renderTable({ sort: { field: 'name', direction: 'desc' } });
    const nameHeader = screen.getByRole('columnheader', { name: /الاسم/ });
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  });
});

describe('EnterpriseDataTable — filtering & pagination', () => {
  it('filters rows generically via globalFilterAccessor', () => {
    renderTable({
      globalFilter: 'باء',
      globalFilterAccessor: (row) => row.name,
    });
    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(1);
    expect(within(bodyRows[0]).getByText('باء')).toBeInTheDocument();
  });

  it('slices rows in client pagination mode', () => {
    renderTable({ pagination: { page: 2, pageSize: 2 } });
    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[0]).getByText('جيم')).toBeInTheDocument();
  });

  it('navigates pages through onPageChange', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderTable({ pagination: { page: 1, pageSize: 2, onPageChange } });
    await user.click(screen.getByRole('button', { name: 'الصفحة التالية' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('offers page-size selection', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    renderTable({
      pagination: { page: 1, pageSize: 2, onPageSizeChange, pageSizeOptions: [2, 4] },
    });
    await user.selectOptions(screen.getByRole('combobox', { name: 'عدد الصفوف في الصفحة' }), '4');
    expect(onPageSizeChange).toHaveBeenCalledWith(4);
  });

  it('recovers from an out-of-range page with a first-page action', () => {
    renderTable({
      rows: rows.slice(0, 2),
      pagination: { page: 3, pageSize: 2 },
    });
    expect(screen.getByText('هذه الصفحة خارج نطاق النتائج')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'العودة إلى الصفحة الأولى' })).toBeInTheDocument();
  });
});

describe('EnterpriseDataTable — selection & row actions', () => {
  it('selects the whole page from the header checkbox', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTable({ selectable: true, selectedKeys: [], onSelectionChange });
    await user.click(screen.getByRole('checkbox', { name: 'تحديد كل الصفوف في الصفحة' }));
    expect(onSelectionChange).toHaveBeenCalledWith(['1', '2', '3', '4']);
  });

  it('toggles a single row from its checkbox', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTable({ selectable: true, selectedKeys: ['2'], onSelectionChange });
    await user.click(screen.getByRole('checkbox', { name: 'تحديد الصف 1' }));
    expect(onSelectionChange).toHaveBeenCalledWith(['2', '1']);
  });

  it('marks selected rows with aria-selected', () => {
    renderTable({ selectable: true, selectedKeys: ['1', '3'] });
    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows[0]).toHaveAttribute('aria-selected', 'true');
    expect(bodyRows[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('renders the sticky actions column and opens the menu', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    renderTable({
      rowActions: (row) => [{ id: 'view', label: 'عرض', onSelect: onView }],
    });
    const trigger = screen.getAllByRole('button', { name: /إجراءات الصف/ })[0];
    await user.click(trigger);
    await user.click(await screen.findByText('عرض'));
    expect(onView).toHaveBeenCalledTimes(1);
    const stickyHead = screen.getByText('إجراءات');
    expect(stickyHead.closest('th')?.className).toContain('sticky');
  });
});

describe('EnterpriseDataTable — interaction affordances', () => {
  it('invokes onRowClick from keyboard (Enter) on the focused row', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    renderTable({ onRowClick });
    const bodyRow = screen.getAllByRole('row')[1];
    bodyRow.focus();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it('moves row focus with ArrowDown / ArrowUp', async () => {
    const user = userEvent.setup();
    renderTable();
    const bodyRows = screen.getAllByRole('row').slice(1);
    (bodyRows[0] as HTMLElement).focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(bodyRows[1]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(bodyRows[0]);
  });

  it('renders mobile cards instead of hiding rows on small screens', () => {
    renderTable({ renderMobileCard: (row) => <div data-card>{row.name}</div> });
    expect(document.querySelectorAll('[data-card]')).toHaveLength(rows.length);
  });

  it('pins the header inside the scroll container when stickyHeader is on', () => {
    renderTable();
    const nameHeader = screen.getByRole('columnheader', { name: /الاسم/ });
    expect(nameHeader.className).toContain('sticky');
    expect(nameHeader.className).toContain('top-0');
  });
});
