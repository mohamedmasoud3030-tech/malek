import { describe, expect, it } from 'vitest';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { ReceiptRecord } from '@/features/financials/receipts/receiptService';
import { buildDeferredRevenueAudit, buildExecutiveHealthInsights } from './reports-insights';

function contract(overrides: Partial<ContractListItem> = {}): ContractListItem {
  return {
    id: 'contract-1',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    people: { id: 'tenant-1', full_name: 'أحمد', phone: null, email: null, national_id: null },
    properties: { id: 'property-1', title: 'برج الخوير', address: null },
    ...overrides,
  } as ContractListItem;
}

function receipt(overrides: Partial<ReceiptRecord> = {}): ReceiptRecord {
  return {
    id: 'payment-1',
    receipt_number: 'REC-1',
    payment_id: 'payment-1',
    invoice_id: 'invoice-1',
    invoice_status: 'issued',
    contract_id: 'contract-1',
    payment_date: '2025-12-20',
    amount: 1200,
    payment_method: 'bank_transfer',
    reference_number: null,
    created_at: '2025-12-20T10:00:00.000Z',
    status: 'posted',
    tenant_name: 'أحمد',
    unit_number: 'A-1',
    property_title: 'برج الخوير',
    ...overrides,
  };
}

describe('buildDeferredRevenueAudit', () => {
  it('builds a schedule only from posted, linked, pre-start receipts', () => {
    const report = buildDeferredRevenueAudit(
      [contract()],
      [
        receipt(),
        receipt({ id: 'payment-2', payment_id: 'payment-2', status: 'void', amount: 500 }),
        receipt({ id: 'payment-3', payment_id: 'payment-3', contract_id: null, amount: 300 }),
        receipt({ id: 'payment-4', payment_id: 'payment-4', payment_date: '2026-02-01', amount: 400 }),
      ],
      '2026-07-15',
    );

    expect(report.postedReceiptsCount).toBe(3);
    expect(report.linkedReceiptsCount).toBe(2);
    expect(report.unlinkedReceiptsCount).toBe(1);
    expect(report.candidateReceiptsCount).toBe(1);
    expect(report.candidateContractsCount).toBe(1);
    expect(report.schedule.totalUpfrontCollections).toBe(1200);
    expect(report.schedule.totalRecognizedRevenueToDate).toBe(700);
    expect(report.schedule.totalDeferredLiability).toBe(500);
  });

  it('reports broken contract links without creating a schedule', () => {
    const report = buildDeferredRevenueAudit(
      [],
      [receipt({ contract_id: 'missing-contract' })],
      '2026-07-15',
    );

    expect(report.invalidContractLinksCount).toBe(1);
    expect(report.schedule.schedules).toEqual([]);
  });
});

describe('buildExecutiveHealthInsights', () => {
  it('returns bounded operational ratios', () => {
    const insights = buildExecutiveHealthInsights({
      invoiced: 1000,
      paid: 850,
      outstanding: 150,
      expenses: 200,
      occupiedUnits: 9,
      totalUnits: 10,
    });

    expect(insights[0]?.value).toBe(85);
    expect(insights[1]?.value).toBeCloseTo(23.5294117647, 10);
    expect(insights[2]?.value).toBe(90);
    expect(insights[3]?.value).toBe(15);
    expect(insights[0]?.tone).toBe('good');
    expect(insights[2]?.tone).toBe('good');
  });
});
