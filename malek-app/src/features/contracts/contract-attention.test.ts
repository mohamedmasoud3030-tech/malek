import { describe, expect, it } from 'vitest';
import type { DossierInvoiceRow } from '@/features/financials/invoices/invoiceService';
import { contractRowFixtureDefaults } from '@/test/contractRowFixture';
import {
  deriveContractAttention,
  groupInvoicesByContractId,
  summarizeContractAttention,
} from './contract-attention';
import type { ContractListItem } from './services/contractService';

/**
 * A pinned "today" makes every assertion exact: expiry, invoice lateness and
 * the lifecycle next step all derive from this one value, never from the clock.
 */
const TODAY = '2026-08-27';

function contract(overrides: Partial<ContractListItem> = {}): ContractListItem {
  return {
    ...contractRowFixtureDefaults,
    id: 'contract-1',
    property_id: 'property-1',
    unit_id: 'unit-1',
    tenant_id: 'tenant-1',
    start_date: '2026-01-01',
    // Far enough out that no expiry window is in play unless a test says so.
    end_date: '2027-08-27',
    rent_amount: 1000,
    payment_cycle: 'monthly',
    payment_terms_id: null,
    status: 'active',
    cancellation_reason: null,
    renewed_from_id: null,
    notes: null,
    attachment_url: null,
    agreement_id: null,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    properties: null,
    units: null,
    people: null,
    ...overrides,
  } as ContractListItem;
}

function invoice(overrides: Partial<DossierInvoiceRow> & { id: string }): DossierInvoiceRow {
  return {
    reference: null,
    contract_id: 'contract-1',
    status: 'UNPAID',
    amount: 1000,
    paid_amount: 0,
    due_date: '2026-08-01',
    ...overrides,
  };
}

const flagsOf = (attention: ReturnType<typeof deriveContractAttention>) =>
  attention.reasons.map((reason) => reason.flag);

describe('contract operational attention', () => {
  it('reports no attention for a healthy active contract with settled invoices', () => {
    const attention = deriveContractAttention(
      contract(),
      [invoice({ id: 'i-1', status: 'PAID', amount: 1000, paid_amount: 1000 })],
      TODAY,
    );

    expect(attention.reasons).toHaveLength(0);
    expect(attention.primaryReason).toBeNull();
    expect(attention.severity).toBeNull();
    expect(attention.receivableInvoiceCount).toBe(0);
    expect(attention.outstandingAmount).toBe(0);
    // Nothing lifecycle-wise is due either: renewal is not recommended early.
    expect(attention.nextAction).toBeNull();
  });

  it('flags expiry risk inside the canonical 30-day window and nothing before it', () => {
    const inside = deriveContractAttention(contract({ end_date: '2026-09-10' }), [], TODAY);
    const outside = deriveContractAttention(contract({ end_date: '2026-10-01' }), [], TODAY);

    expect(inside.daysUntilEnd).toBe(14);
    expect(flagsOf(inside)).toEqual(['expiring_soon']);
    expect(inside.primaryReason?.detail).toBe('خلال 14 يوم');
    expect(inside.severity).toBe('warning');
    // Inside the window, renewal genuinely becomes the next step.
    expect(inside.nextAction).toBe('renew');

    expect(outside.daysUntilEnd).toBe(35);
    expect(flagsOf(outside)).toEqual([]);
    expect(outside.nextAction).toBeNull();
  });

  it('treats an expired contract as expired rather than merely expiring', () => {
    const attention = deriveContractAttention(
      contract({ status: 'expired' as ContractListItem['status'], end_date: '2026-06-30' }),
      [],
      TODAY,
    );

    expect(attention.isExpired).toBe(true);
    expect(flagsOf(attention)).toEqual(['expired']);
    expect(attention.severity).toBe('danger');
    expect(attention.nextAction).toBe('renew');
  });

  it('flags an overdue invoice and measures lateness canonically', () => {
    const attention = deriveContractAttention(
      contract(),
      [invoice({ id: 'i-1', status: 'UNPAID', due_date: '2026-08-01' })],
      TODAY,
    );

    expect(attention.overdueInvoiceCount).toBe(1);
    expect(attention.oldestOverdueDays).toBe(26);
    expect(attention.overdueAmount).toBe(1000);
    expect(flagsOf(attention)).toEqual(['overdue_invoice']);
    expect(attention.primaryReason?.detail).toBe('منذ 26 يوم');
    expect(attention.severity).toBe('danger');
    // A payment problem must not invent a lifecycle action.
    expect(attention.nextAction).toBeNull();
  });

  it('treats unpaid and partially paid invoices as outstanding without calling them overdue', () => {
    const futureUnpaid = deriveContractAttention(
      contract(),
      [invoice({ id: 'i-1', status: 'UNPAID', amount: 600, due_date: '2026-09-15' })],
      TODAY,
    );
    const partial = deriveContractAttention(
      contract(),
      [invoice({ id: 'i-2', status: 'PARTIALLY_PAID', amount: 800, paid_amount: 300, due_date: '2026-09-20' })],
      TODAY,
    );

    for (const attention of [futureUnpaid, partial]) {
      expect(attention.overdueInvoiceCount).toBe(0);
      expect(attention.oldestOverdueDays).toBe(0);
      expect(flagsOf(attention)).toEqual(['outstanding_balance']);
      expect(attention.severity).toBe('warning');
    }
    expect(futureUnpaid.outstandingAmount).toBe(600);
    expect(partial.outstandingAmount).toBe(500);
  });

  it('does not report a false overdue when status or date says otherwise', () => {
    // Settled long after its due date: paid means paid, whatever the calendar.
    const settled = deriveContractAttention(
      contract(),
      [invoice({ id: 'i-1', status: 'PAID', amount: 1000, paid_amount: 1000, due_date: '2026-01-01' })],
      TODAY,
    );
    // Legacy lowercase and modern uppercase casings must behave identically.
    const legacyPaid = deriveContractAttention(
      contract(),
      [invoice({ id: 'i-2', status: 'paid', amount: 1000, paid_amount: 1000, due_date: '2026-01-01' })],
      TODAY,
    );
    // Not yet due today: lateness is 0, not 1.
    const dueToday = deriveContractAttention(
      contract(),
      [invoice({ id: 'i-3', status: 'UNPAID', due_date: TODAY })],
      TODAY,
    );
    // Void/cancelled/draft rows never contribute to arrears.
    const voided = deriveContractAttention(
      contract(),
      [invoice({ id: 'i-4', status: 'VOID', due_date: '2026-01-01' })],
      TODAY,
    );

    expect(settled.reasons).toHaveLength(0);
    expect(legacyPaid.reasons).toHaveLength(0);
    expect(dueToday.overdueInvoiceCount).toBe(0);
    expect(flagsOf(dueToday)).toEqual(['outstanding_balance']);
    expect(voided.receivableInvoiceCount).toBe(0);
    expect(voided.reasons).toHaveLength(0);
  });

  it('aggregates several invoices into one exposure per contract', () => {
    const attention = deriveContractAttention(
      contract(),
      [
        invoice({ id: 'a', status: 'OVERDUE', amount: 1000, paid_amount: 0, due_date: '2026-08-01' }),
        invoice({ id: 'b', status: 'PARTIALLY_PAID', amount: 800, paid_amount: 300, due_date: '2026-07-28' }),
        invoice({ id: 'c', status: 'UNPAID', amount: 600, paid_amount: 0, due_date: '2026-09-15' }),
        invoice({ id: 'd', status: 'PAID', amount: 900, paid_amount: 900, due_date: '2026-07-01' }),
      ],
      TODAY,
    );

    expect(attention.receivableInvoiceCount).toBe(3);
    expect(attention.overdueInvoiceCount).toBe(2);
    expect(attention.oldestOverdueDays).toBe(30);
    expect(attention.outstandingAmount).toBe(2100);
    expect(attention.overdueAmount).toBe(1500);
    expect(attention.primaryReason?.flag).toBe('overdue_invoice');
    expect(attention.primaryReason?.detail).toBe('منذ 30 يوم');
    // Overdue outranks merely-outstanding, so the row leads with the real risk.
    expect(flagsOf(attention)).toEqual(['overdue_invoice', 'outstanding_balance']);
    expect(attention.reasons[1]?.detail).toBe('1 فاتورة غير مسددة');
  });

  it('surfaces approval-stage lifecycle attention and its canonical next step', () => {
    const pending = deriveContractAttention(contract({ status: 'draft' as ContractListItem['status'], approval_status: 'PENDING' }), [], TODAY);
    const approved = deriveContractAttention(contract({ status: 'draft' as ContractListItem['status'], approval_status: 'APPROVED' }), [], TODAY);
    const rejected = deriveContractAttention(contract({ status: 'draft' as ContractListItem['status'], approval_status: 'REJECTED' }), [], TODAY);
    const fresh = deriveContractAttention(contract({ status: 'draft' as ContractListItem['status'], approval_status: null }), [], TODAY);

    expect(flagsOf(pending)).toEqual(['approval_pending']);
    expect(pending.nextAction).toBe('approve_or_reject');

    expect(flagsOf(approved)).toEqual(['approved_pending_activation']);
    expect(approved.nextAction).toBe('activate');

    expect(flagsOf(rejected)).toEqual(['approval_rejected']);
    expect(rejected.severity).toBe('danger');
    expect(rejected.nextAction).toBe('submit_for_approval');

    // A fresh draft has a next step but is not itself a problem.
    expect(fresh.reasons).toHaveLength(0);
    expect(fresh.nextAction).toBe('submit_for_approval');
  });

  it('derives every signal from the supplied date, not the wall clock', () => {
    const invoices = [invoice({ id: 'i-1', status: 'UNPAID', due_date: '2026-08-01' })];
    const earlier = deriveContractAttention(contract(), invoices, '2026-08-11');
    const later = deriveContractAttention(contract(), invoices, '2026-09-30');

    expect(earlier.oldestOverdueDays).toBe(10);
    expect(later.oldestOverdueDays).toBe(60);
    // Re-running with the same date is stable.
    expect(deriveContractAttention(contract(), invoices, '2026-08-11')).toEqual(earlier);
  });

  it('keeps payment context unknown distinct from verified clean', () => {
    const loading = deriveContractAttention(contract(), [], TODAY, { invoiceContextLoaded: false });

    expect(loading.invoiceContextLoaded).toBe(false);
    expect(loading.reasons).toHaveLength(0);
    expect(deriveContractAttention(contract(), [], TODAY).invoiceContextLoaded).toBe(true);
  });

  it('summarises the register into decision-support counts', () => {
    const withOverdue = deriveContractAttention(
      contract({ id: 'a' }),
      [invoice({ id: 'i-1', contract_id: 'a', due_date: '2026-08-01' })],
      TODAY,
    );
    const expiring = deriveContractAttention(contract({ id: 'b', end_date: '2026-09-05' }), [], TODAY);
    const healthy = deriveContractAttention(contract({ id: 'c' }), [], TODAY);

    const summary = summarizeContractAttention([withOverdue, expiring, healthy]);

    expect(summary.needingAttention).toBe(2);
    expect(summary.paymentAttention).toBe(1);
    expect(summary.overdueInvoices).toBe(1);
    expect(summary.overdueAmount).toBe(1000);
    expect(summary.outstandingAmount).toBe(1000);
    expect(summary.expiryAttention).toBe(1);
    expect(summary.lifecycleAttention).toBe(0);
  });

  it('groups a flat batched read by contract for O(n) derivation', () => {
    const grouped = groupInvoicesByContractId([
      invoice({ id: 'i-1', contract_id: 'a' }),
      invoice({ id: 'i-2', contract_id: 'b' }),
      invoice({ id: 'i-3', contract_id: 'a' }),
    ]);

    expect(grouped.get('a')?.map((row) => row.id)).toEqual(['i-1', 'i-3']);
    expect(grouped.get('b')?.map((row) => row.id)).toEqual(['i-2']);
    expect(grouped.get('missing')).toBeUndefined();
  });
});
