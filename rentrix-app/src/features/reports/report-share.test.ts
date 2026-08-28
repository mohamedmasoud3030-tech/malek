import { describe, expect, it } from 'vitest';
import {
  REPORT_SHARE_TEXT_MAX_LENGTH,
  buildReportSharePayload,
  buildReportShareText,
  buildReportShareUrl,
} from './report-share';

const baseTarget = {
  section: 'analytics' as const,
  view: 'overdue' as const,
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

describe('buildReportShareUrl', () => {
  it('builds the canonical /reports deep link with section, view and period', () => {
    const url = buildReportShareUrl('https://app.example.com/', baseTarget);
    expect(url).toBe(
      'https://app.example.com/reports?section=analytics&view=overdue&from=2026-08-01&to=2026-08-27&asOf=2026-08-27',
    );
  });

  it('includes entity scope when present and omits empty filters', () => {
    const url = buildReportShareUrl('https://app.example.com', {
      ...baseTarget,
      filters: { ...baseTarget.filters, tenantId: 'tenant-1', ownerId: '' },
    });
    expect(url).toContain('tenantId=tenant-1');
    expect(url).not.toContain('ownerId=');
  });

  it('keeps the statements section linkable without a view', () => {
    const url = buildReportShareUrl('https://app.example.com', {
      ...baseTarget,
      section: 'statements',
      view: '',
    });
    expect(url).toBe(
      'https://app.example.com/reports?section=statements&from=2026-08-01&to=2026-08-27&asOf=2026-08-27',
    );
  });
});

describe('buildReportShareText', () => {
  it('prepares label, summary and link in readable Arabic lines', () => {
    const text = buildReportShareText({
      reportLabel: 'تعتيق المتأخرات',
      summaryText: 'إجمالي المتأخرات 2,350 ر.ع.',
      url: 'https://app.example.com/reports?section=analytics&view=overdue',
    });
    expect(text).toBe(
      'تعتيق المتأخرات\nإجمالي المتأخرات 2,350 ر.ع.\nhttps://app.example.com/reports?section=analytics&view=overdue',
    );
  });

  it('always keeps the link line even without a summary', () => {
    const text = buildReportShareText({
      reportLabel: 'كشف التحصيل',
      url: 'https://app.example.com/reports?section=analytics&view=collections',
    });
    expect(text).toContain('https://app.example.com/reports');
  });

  it('caps very long messages instead of failing the composer', () => {
    const text = buildReportShareText({
      reportLabel: 'تقرير',
      summaryText: 'x'.repeat(REPORT_SHARE_TEXT_MAX_LENGTH * 2),
      url: 'https://app.example.com/reports',
    });
    expect(text.length).toBeLessThanOrEqual(REPORT_SHARE_TEXT_MAX_LENGTH + 1);
  });
});

describe('buildReportSharePayload', () => {
  it('combines the deep link and the prepared message', () => {
    const payload = buildReportSharePayload('https://app.example.com', baseTarget, {
      reportLabel: 'تعتيق المتأخرات',
      summaryText: 'إجمالي المتأخرات 2,350 ر.ع.',
    });
    expect(payload.url).toContain('/reports?section=analytics&view=overdue');
    expect(payload.shareText).toContain('تعتيق المتأخرات');
    expect(payload.shareText.endsWith(payload.url)).toBe(true);
  });
});
