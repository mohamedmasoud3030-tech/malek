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
      label: '2026-07-01 إلى 2026-07-15 · حتى 2026-07-15',
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
      label: '2026-06-01 إلى 2026-06-30 · حتى 2026-06-30 · المكتب الرئيسي · محمد أحمد · عقد contract',
    });
  });
});
