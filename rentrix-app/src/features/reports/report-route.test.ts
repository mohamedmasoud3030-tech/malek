import { describe, expect, it } from 'vitest';
import { getInitialReportsFilters } from './reports-workspace-filters';
import { getReportProduct, getReportProductTarget } from './report-products';
import {
  buildReportProductSearch,
  diffReportFiltersFromSearch,
  resolveLegacyProductTarget,
  resolveLegacyReportLocation,
} from './report-route';

const collections = getReportProduct('collections-arrears-cheques')!;
const portfolio = getReportProduct('portfolio-property-performance')!;

describe('canonical report-product routing', () => {
  it('writes target IDs and supported filters only, without retired route keys', () => {
    const target = getReportProductTarget(collections, 'arrears');
    const search = buildReportProductSearch(
      {
        workspace: 'collections',
        section: 'analytics',
        report: 'legacy',
        target: 'old',
        keep: 'yes',
      },
      target,
      {
        ...getInitialReportsFilters({
          from: '2026-08-01',
          to: '2026-08-31',
          asOf: '2026-08-31',
          propertyId: 'property-1',
          ownerId: 'owner-1',
          costCenterId: 'cc-1',
          status: 'overdue',
        }),
      },
    );

    expect(search).toEqual({
      keep: 'yes',
      view: 'arrears',
      from: '2026-08-01',
      to: '2026-08-31',
      asOf: '2026-08-31',
      propertyId: 'property-1',
      status: 'overdue',
    });
  });

  it('keeps dependent scope safe while drilling into a target', () => {
    const target = getReportProductTarget(portfolio, 'property');
    const search = buildReportProductSearch(
      {},
      target,
      getInitialReportsFilters({
        from: '2026-08-01',
        to: '2026-08-31',
        propertyId: 'property-1',
        unitId: 'unit-1',
        tenantId: 'tenant-1',
        contractId: 'contract-1',
      }),
      { propertyId: 'property-2' },
    );

    expect(search).toEqual({
      view: 'property',
      from: '2026-08-01',
      to: '2026-08-31',
      propertyId: 'property-2',
    });
  });

  it('mirrors URL entity removals into a canonical filter patch without clobbering absent dates', () => {
    expect(
      diffReportFiltersFromSearch(
        {
          from: '2026-08-01',
          to: '2026-08-31',
          propertyId: 'p-1',
          unitId: 'u-1',
        },
        { to: 'invalid', propertyId: 'p-2' },
      ),
    ).toEqual({ propertyId: 'p-2', unitId: '' });
  });
});

describe('legacy Reports URL resolution', () => {
  it('maps shipped workspace and section/view bookmarks to one product target', () => {
    expect(
      resolveLegacyReportLocation({
        workspace: 'collections',
        view: 'overdue',
        propertyId: 'p-1',
      }),
    ).toMatchObject({
      product: { id: 'collections-arrears-cheques' },
      target: { id: 'arrears' },
    });
    expect(resolveLegacyReportLocation({ view: 'overdue' })).toMatchObject({
      product: { id: 'collections-arrears-cheques' },
      target: { id: 'arrears' },
    });
    expect(
      resolveLegacyReportLocation({
        section: 'property_analytics',
        propertyId: 'p-1',
      }),
    ).toMatchObject({
      product: { id: 'portfolio-property-performance' },
      target: { id: 'property' },
    });
    expect(
      resolveLegacyReportLocation({
        section: 'accounting',
        view: 'general_ledger',
      }),
    ).toMatchObject({
      product: { id: 'financial-settlement-pack' },
      target: { id: 'ledger' },
    });
  });

  it('routes legacy statements only when a single party context proves the intended product', () => {
    expect(
      resolveLegacyReportLocation({ section: 'statements' }),
    ).toBeUndefined();
    expect(
      resolveLegacyReportLocation({
        workspace: 'statements',
        ownerId: 'owner-1',
      }),
    ).toMatchObject({
      product: { id: 'owner-comprehensive-statement' },
      target: { id: 'statement' },
    });
    expect(
      resolveLegacyReportLocation({
        workspace: 'statements',
        contractId: 'contract-1',
      }),
    ).toMatchObject({
      product: { id: 'tenant-statement' },
      target: { id: 'statement' },
    });
    expect(
      resolveLegacyReportLocation({
        workspace: 'statements',
        ownerId: 'owner-1',
        contractId: 'contract-1',
      }),
    ).toBeUndefined();
  });

  it('normalizes early product URLs that used retained body view IDs', () => {
    expect(resolveLegacyProductTarget(collections, 'overdue')).toMatchObject({
      id: 'arrears',
    });
    expect(resolveLegacyProductTarget(collections, 'arrears')).toBeUndefined();
  });
});
