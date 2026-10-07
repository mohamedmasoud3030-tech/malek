import { describe, expect, it } from 'vitest';
import {
  getAgingBucketKeyFromDaysOverdue,
  getAgingBucketLabel,
  type OverdueInvoiceReportRow,
} from '../reports/financialReportsService';
import {
  OVER_90_BUCKET_KEY,
  arrearsBucketOptions,
  filterOverdueInvoiceRows,
  getOverdueRowBucketKey,
  safePercentage,
} from './arrears-workflow-helpers';

function createRow(overrides: Partial<OverdueInvoiceReportRow>): OverdueInvoiceReportRow {
  return {
    invoiceId: 'invoice_alpha_123456',
    shortInvoiceId: 'invoice_',
    contractId: 'contract_alpha_123456',
    tenantId: 'tenant_alpha',
    tenantName: 'أحمد علي',
    propertyId: 'property_alpha',
    propertyTitle: 'برج النخيل',
    unitId: 'unit_alpha',
    unitNumber: 'A-101',
    dueDate: '2026-04-01',
    daysOverdue: 15,
    amount: 1000,
    paidAmount: 200,
    remainingAmount: 800,
    status: 'partial',
    ...overrides,
  };
}

describe('arrears workflow helpers', () => {
  it('labels workflow buckets with the single canonical aging vocabulary', () => {
    expect(getAgingBucketLabel('current')).toBe('غير متأخر');
    expect(getAgingBucketLabel(OVER_90_BUCKET_KEY)).toBe('أكثر من 90 يوم');
    expect(arrearsBucketOptions.map((option) => option.label)).toEqual([
      'كل الأعمار', 'غير متأخر', '1–30 يوم', '31–60 يوم', '61–90 يوم', 'أكثر من 90 يوم',
    ]);
  });

  it('maps days overdue into stable buckets and prefers a server bucket when present', () => {
    expect(getAgingBucketKeyFromDaysOverdue(-5)).toBe('current');
    expect(getAgingBucketKeyFromDaysOverdue(Number.NaN)).toBe('current');
    expect(getAgingBucketKeyFromDaysOverdue(30)).toBe('days_1_30');
    expect(getAgingBucketKeyFromDaysOverdue(31)).toBe('days_31_60');
    expect(getAgingBucketKeyFromDaysOverdue(61)).toBe('days_61_90');
    expect(getAgingBucketKeyFromDaysOverdue(91)).toBe(OVER_90_BUCKET_KEY);
    expect(getOverdueRowBucketKey({ daysOverdue: 5, bucket: OVER_90_BUCKET_KEY })).toBe(OVER_90_BUCKET_KEY);
    expect(getOverdueRowBucketKey({ daysOverdue: 45 })).toBe('days_31_60');
  });

  it('calculates safe percentages without NaN or Infinity output', () => {
    expect(safePercentage(25, 100)).toBe(25);
    expect(safePercentage(Number.NaN, 100)).toBe(0);
    expect(safePercentage(25, 0)).toBeNull();
    expect(safePercentage(25, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('filters rows by search fields and bucket without backend-only assumptions', () => {
    const rows = [
      createRow({ invoiceId: 'invoice_alpha_123456', shortInvoiceId: 'alpha123', tenantName: 'أحمد علي', daysOverdue: 15 }),
      createRow({ invoiceId: 'invoice_beta_123456', shortInvoiceId: 'beta1234', tenantName: 'سارة خالد', propertyTitle: 'واحة الرياض', daysOverdue: 45 }),
      createRow({ invoiceId: 'invoice_gamma_123456', shortInvoiceId: 'gamma12', contractId: 'contract_gamma_123456', unitNumber: 'B-22', daysOverdue: 120 }),
    ];

    expect(filterOverdueInvoiceRows(rows, 'سارة', 'all').map((row) => row.invoiceId)).toEqual(['invoice_beta_123456']);
    expect(filterOverdueInvoiceRows(rows, 'B-22', OVER_90_BUCKET_KEY).map((row) => row.invoiceId)).toEqual(['invoice_gamma_123456']);
    expect(filterOverdueInvoiceRows(rows, 'contract_gamma', 'days_1_30')).toEqual([]);
  });
});
