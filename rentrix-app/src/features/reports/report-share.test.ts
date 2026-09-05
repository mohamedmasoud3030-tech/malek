import { describe, expect, it } from 'vitest';
import {
  REPORT_SHARE_TEXT_MAX_LENGTH,
  buildReportProductSharePayload,
  buildReportProductShareUrl,
  buildReportShareText,
} from './report-share';

const arrearsTarget = {
  reportId: 'collections-arrears-cheques' as const,
  view: 'arrears',
  filters: {
    from: '2026-08-01',
    to: '2026-08-27',
    asOf: '2026-08-27',
    propertyId: '',
    unitId: '',
    tenantId: '',
    ownerId: '',
    contractId: '',
  },
};

describe('canonical report product share URL', () => {
  it('builds the product route with target and active period', () => {
    expect(
      buildReportProductShareUrl('https://app.example.com/', arrearsTarget),
    ).toBe(
      'https://app.example.com/reports/collections-arrears-cheques?view=arrears&from=2026-08-01&to=2026-08-27&asOf=2026-08-27',
    );
  });

  it('preserves only non-empty scope values', () => {
    expect(
      buildReportProductShareUrl('https://app.example.com', {
        ...arrearsTarget,
        filters: {
          ...arrearsTarget.filters,
          propertyId: 'property-1',
          tenantId: 'tenant-1',
        },
      }),
    ).toContain('propertyId=property-1&tenantId=tenant-1');
  });
});

describe('report share text', () => {
  it('puts business label, summary, and canonical product URL on separate lines', () => {
    const text = buildReportShareText({
      reportLabel: 'تعتيق المتأخرات',
      summaryText: 'إجمالي المتأخرات 2,350 ر.ع.',
      url: 'https://app.example.com/reports/collections-arrears-cheques?view=arrears',
    });
    expect(text).toBe(
      'تعتيق المتأخرات\nإجمالي المتأخرات 2,350 ر.ع.\nhttps://app.example.com/reports/collections-arrears-cheques?view=arrears',
    );
  });

  it('caps text at the product share safety limit', () => {
    expect(
      buildReportShareText({
        reportLabel: 'تقرير',
        summaryText: 'x'.repeat(REPORT_SHARE_TEXT_MAX_LENGTH + 50),
        url: 'https://example.test/reports/x',
      }),
    ).toHaveLength(REPORT_SHARE_TEXT_MAX_LENGTH);
  });

  it('builds URL and text from one canonical target', () => {
    const payload = buildReportProductSharePayload(
      'https://app.example.com',
      arrearsTarget,
      {
        reportLabel: 'تعتيق المتأخرات',
        summaryText: 'إجمالي المتأخرات 2,350 ر.ع.',
      },
    );
    expect(payload.url).toContain(
      '/reports/collections-arrears-cheques?view=arrears',
    );
    expect(payload.shareText.endsWith(payload.url)).toBe(true);
  });
});
