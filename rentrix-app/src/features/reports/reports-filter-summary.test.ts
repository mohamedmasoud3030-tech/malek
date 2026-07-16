import { describe, expect, it } from 'vitest';
import { buildReportFilterSummary } from './reports-filter-summary';
import type { FilterState } from './reports-page.helpers';

const defaults: FilterState = {
  from: '2026-07-01',
  to: '2026-07-15',
  asOf: '2026-07-15',
  costCenterId: '',
  ownerId: '',
  contractId: '',
};

describe('buildReportFilterSummary', () => {
  it('keeps the default period visible without marking it as an active override', () => {
    expect(buildReportFilterSummary(defaults, defaults, {})).toEqual({
      activeCount: 0,
      label: 'الفترة: 2026-07-01 — 2026-07-15 · حتى: 2026-07-15',
      chips: [
        { key: 'period', label: 'الفترة', value: '2026-07-01 — 2026-07-15', isActive: false },
        { key: 'asOf', label: 'حتى', value: '2026-07-15', isActive: false },
      ],
    });
  });

  it('counts date overrides as one filter and includes selected entity labels', () => {
    const filters: FilterState = {
      from: '2026-06-01',
      to: '2026-06-30',
      asOf: '2026-06-30',
      costCenterId: 'cost-center-1',
      ownerId: 'owner-1',
      contractId: 'contract-1',
    };

    expect(buildReportFilterSummary(filters, defaults, {
      costCenter: 'المكتب الرئيسي',
      owner: 'محمد أحمد',
      contract: 'عقد contract',
    })).toEqual({
      activeCount: 4,
      label: 'الفترة: 2026-06-01 — 2026-06-30 · حتى: 2026-06-30 · مركز التكلفة: المكتب الرئيسي · المالك: محمد أحمد · العقد: عقد contract',
      chips: [
        { key: 'period', label: 'الفترة', value: '2026-06-01 — 2026-06-30', isActive: true },
        { key: 'asOf', label: 'حتى', value: '2026-06-30', isActive: true },
        { key: 'costCenter', label: 'مركز التكلفة', value: 'المكتب الرئيسي', isActive: true },
        { key: 'owner', label: 'المالك', value: 'محمد أحمد', isActive: true },
        { key: 'contract', label: 'العقد', value: 'عقد contract', isActive: true },
      ],
    });
  });
});
