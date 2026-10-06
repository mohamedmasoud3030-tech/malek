// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { getInitialReportsFilters } from '../reports-workspace-filters';

vi.mock('./FiltersPanel', async () => {
  const { createElement } = await import('react');
  return {
    FiltersPanel: ({ activeFilters = [], onClearAllFilters }: {
      activeFilters?: readonly ActiveFilterItem[];
      onClearAllFilters?: () => void;
    }) => createElement('div', null,
      ...activeFilters.map((filter) => createElement('button', {
        key: filter.key,
        type: 'button',
        'aria-label': `remove-${filter.key}`,
        onClick: filter.onRemove,
      }, filter.value)),
      onClearAllFilters
        ? createElement('button', { type: 'button', onClick: onClearAllFilters }, 'clear-all')
        : null,
    ),
  };
});

import { ReportsFilterSurface } from './ReportsFilterSurface';

describe('ReportsFilterSurface active filters', () => {
  afterEach(cleanup);

  it('compares selected dates to the canonical defaults and makes the date override removable', () => {
    const defaults = getInitialReportsFilters();
    const filters = {
      ...defaults,
      from: '2026-01-01',
      to: '2026-01-31',
      propertyId: 'property-1',
    };
    const onChange = vi.fn();
    render(<ReportsFilterSurface
      filters={filters}
      costCenterRows={[]}
      ownerRows={[]}
      contractRows={[]}
      onChange={onChange}
      onResetCurrentMonth={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'remove-report-period' }));

    expect(onChange).toHaveBeenCalledWith({ ...filters, from: defaults.from, to: defaults.to });
  });

  it('clears all selected dimensions while restoring the canonical date defaults', () => {
    const defaults = getInitialReportsFilters();
    const filters = {
      ...defaults,
      from: '2026-01-01',
      to: '2026-01-31',
      propertyId: 'property-1',
      unitId: 'unit-1',
      tenantId: 'tenant-1',
      costCenterId: 'cost-center-1',
      ownerId: 'owner-1',
      contractId: 'contract-1',
      status: 'paid' as const,
    };
    const onChange = vi.fn();
    render(<ReportsFilterSurface
      filters={filters}
      costCenterRows={[]}
      ownerRows={[]}
      contractRows={[]}
      onChange={onChange}
      onResetCurrentMonth={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'clear-all' }));

    expect(onChange).toHaveBeenCalledWith({
      ...defaults,
      propertyId: '',
      unitId: '',
      tenantId: '',
      costCenterId: '',
      ownerId: '',
      contractId: '',
      status: 'all',
    });
  });
});
