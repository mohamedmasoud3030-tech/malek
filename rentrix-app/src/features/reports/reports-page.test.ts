import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import { contractRowFixtureDefaults } from '@/test/contractRowFixture';
import { createReceiptPrintHref } from '@/features/financials/receipts/receipt-print';
import { buildAgingBucketChartRows, buildExpiringContractsRows, buildOccupancyRows, buildPaymentsTrendRows, buildPropertyPerformanceRows, buildRentRollRows } from './reports-page.helpers';
import { escapeCsvValue } from '@/lib/csvExport';
import {
  buildReportCsvFilename,
  toDateInputValue,
} from './reports-page.helpers';

function createContract(overrides: Partial<ContractListItem>): ContractListItem {
  return {
    ...contractRowFixtureDefaults,
    id: 'contract_a',
    property_id: 'property_a',
    unit_id: 'unit_a',
    tenant_id: 'tenant_a',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_amount: 1200,
    payment_cycle: 'monthly',
    payment_terms_id: null,
    status: 'active',
    cancellation_reason: null,
    renewed_from_id: null,
    notes: null,
    attachment_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    properties: { id: 'property_a', title: 'برج النخيل', address: 'Dubai' },
    units: { id: 'unit_a', unit_number: '101', floor: '1', status: 'occupied', rent_amount: 1200 },
    people: { id: 'tenant_a', full_name: 'أحمد علي', phone: null, email: null, national_id: null },
    ...overrides,
    agreement_id: overrides.agreement_id ?? null,
  };
}

describe('ReportsPage shaping helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('combines canonical daily collection and overdue invoice rows by month', () => {
    expect(buildPaymentsTrendRows({
      dailyCollections: [
        { paymentDate: '2026-05-01', totalPaid: 100, paymentsCount: 1, methodTotals: { cash: 100, bank_transfer: 0, card: 0, check: 0, other: 0 } },
        { paymentDate: '2026-05-20', totalPaid: 75, paymentsCount: 1, methodTotals: { cash: 0, bank_transfer: 75, card: 0, check: 0, other: 0 } },
        { paymentDate: '2026-06-01', totalPaid: 25, paymentsCount: 1, methodTotals: { cash: 0, bank_transfer: 0, card: 25, check: 0, other: 0 } },
      ],
      overdueInvoices: [
        { invoiceId: 'invoice_1', shortInvoiceId: 'invoice_', contractId: 'contract_1', tenantId: null, tenantName: null, propertyId: null, propertyTitle: null, unitId: null, unitNumber: null, dueDate: '2026-05-10', daysOverdue: 4, amount: 200, paidAmount: 50, remainingAmount: 150, status: 'partial' },
        { invoiceId: 'invoice_2', shortInvoiceId: 'invoice_', contractId: 'contract_2', tenantId: null, tenantName: null, propertyId: null, propertyTitle: null, unitId: null, unitNumber: null, dueDate: '2026-04-30', daysOverdue: 14, amount: 100, paidAmount: 0, remainingAmount: 100, status: 'issued' },
      ],
    })).toEqual([
      { month: '2026-04', collections: 0, overdue: 100 },
      { month: '2026-05', collections: 175, overdue: 150 },
      { month: '2026-06', collections: 25, overdue: 0 },
    ]);
  });

  it('falls back to an unnamed placeholder with short id helper when no property title is supplied', () => {
    expect(buildOccupancyRows([
      { property_id: 'alpha_property', status: 'occupied' },
      { property_id: 'alpha_property', status: 'available' },
      { property_id: 'alpha_property', status: 'maintenance' },
      { property_id: 'beta_property', status: 'occupied' },
    ])).toEqual([
      { property: 'عقار بدون اسم', propertyId: 'alpha_property', shortPropertyId: '', hasTitle: false, occupied: 1, vacant: 1, nonRentable: 1 },
      { property: 'عقار بدون اسم', propertyId: 'beta_property', shortPropertyId: '', hasTitle: false, occupied: 1, vacant: 0, nonRentable: 0 },
    ]);
  });

  it('counts historical upper-case and rented statuses as occupied in cross-feature occupancy reports', () => {
    expect(buildOccupancyRows([
      { property_id: 'alpha_property', status: ' OCCUPIED ' as any },
      { property_id: 'alpha_property', status: 'rented' as any },
      { property_id: 'alpha_property', status: 'available' },
    ])).toEqual([
      { property: 'عقار بدون اسم', propertyId: 'alpha_property', shortPropertyId: '', hasTitle: false, occupied: 2, vacant: 1, nonRentable: 0 },
    ]);
  });

  it('uses the property title and orders titled rows first when titles are supplied', () => {
    expect(buildOccupancyRows(
      [
        { property_id: 'alpha_property', status: 'occupied' },
        { property_id: 'beta_property', status: 'occupied' },
        { property_id: 'gamma_property', status: 'maintenance' },
      ],
      [
        { id: 'beta_property', title: 'برج النخيل' },
        { id: 'gamma_property', title: '   ' }, // blank titles are ignored
      ],
    )).toEqual([
      { property: 'برج النخيل', propertyId: 'beta_property', shortPropertyId: '', hasTitle: true, occupied: 1, vacant: 0, nonRentable: 0 },
      { property: 'عقار بدون اسم', propertyId: 'alpha_property', shortPropertyId: '', hasTitle: false, occupied: 1, vacant: 0, nonRentable: 0 },
      { property: 'عقار بدون اسم', propertyId: 'gamma_property', shortPropertyId: '', hasTitle: false, occupied: 0, vacant: 0, nonRentable: 1 },
    ]);
  });

  it('builds aging bucket chart rows in the requested display order', () => {
    expect(buildAgingBucketChartRows({
      current: { label: 'غير متأخر', total: 20, invoiceCount: 2 },
      days_90_plus: { label: 'أكثر من 90 يوم', total: 300, invoiceCount: 3 },
    }, ['current', 'days_1_30', 'days_90_plus'])).toEqual([
      { bucket: 'غير متأخر', total: 20, invoiceCount: 2 },
      { bucket: 'days_1_30', total: 0, invoiceCount: 0 },
      { bucket: 'أكثر من 90 يوم', total: 300, invoiceCount: 3 },
    ]);
  });

  it('builds rent roll rows from current contract list items without creating balances', () => {
    expect(buildRentRollRows([
      createContract({ id: 'contract_b', people: { id: 'tenant_b', full_name: 'منى سالم', phone: null, email: null, national_id: null } }),
      createContract({ id: 'contract_a' }),
    ], { active: 'نشط', draft: 'مسودة', expired: 'منتهي', terminated: 'منهى' })).toEqual([
      {
        contractId: 'contract_a',
        contractReference: null,
        tenantName: 'أحمد علي',
        propertyTitle: 'برج النخيل',
        unitNumber: '101',
        rentAmount: 1200,
        paymentCycle: 'شهري',
        statusLabel: 'نشط',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      {
        contractId: 'contract_b',
        contractReference: null,
        tenantName: 'منى سالم',
        propertyTitle: 'برج النخيل',
        unitNumber: '101',
        rentAmount: 1200,
        paymentCycle: 'شهري',
        statusLabel: 'نشط',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ]);
  });

  it('builds property performance rows as a decision report instead of separate data islands', () => {
    const rows = buildPropertyPerformanceRows({
      occupancyRows: [
        { property: 'برج النخيل', propertyId: 'property_a', shortPropertyId: '', hasTitle: true, occupied: 3, vacant: 2, nonRentable: 0 },
      ],
      contracts: [createContract({ id: 'contract_a', property_id: 'property_a', rent_amount: 1200 })],
      collectionRows: [{ propertyId: 'property_a', propertyTitle: 'برج النخيل', totalPaid: 900, paymentsCount: 1 }],
      period: { from: '2026-05-01', to: '2026-05-31', asOf: '2026-05-31' },
      overdueRows: [
        { invoiceId: 'invoice_1', shortInvoiceId: 'invoice_', contractId: 'contract_a', tenantId: null, tenantName: null, propertyId: 'property_a', propertyTitle: 'برج النخيل', unitId: null, unitNumber: null, dueDate: '2026-05-10', daysOverdue: 74, amount: 1500, paidAmount: 300, remainingAmount: 1200, status: 'partial' },
      ],
      expenseRows: [{ propertyId: 'property_a', propertyTitle: 'برج النخيل', total: 450, count: 2 }],
      maintenanceRows: [
        { id: 'm1', no: null, property_id: 'property_a', unit_id: null, title: 'تسريب', description: null, priority: 'urgent', status: 'resolved', assigned_to: null, cost: 250, charged_to: null, notes: null, request_date: '2026-05-12', scheduled_date: null, work_description: null, technician_name: null, response_time_hours: null, expense_id: null, invoice_id: null, reported_by: null, completed_at: '2026-05-13', resolved_at: '2026-05-13', created_at: null, updated_at: null, attachment_url: null, deleted_at: null, company_id: 'company_1', reference: null, service_provider_id: null, service_provider_category_id: null, cancelled_at: null, cancellation_reason: null, request_id: null },
        { id: 'm2', no: null, property_id: 'property_a', unit_id: null, title: 'بلاغ مفتوح', description: null, priority: 'high', status: 'open', assigned_to: null, cost: 400, charged_to: null, notes: null, request_date: '2026-05-20', scheduled_date: null, work_description: null, technician_name: null, response_time_hours: null, expense_id: null, invoice_id: null, reported_by: null, completed_at: null, resolved_at: null, created_at: null, updated_at: null, attachment_url: null, deleted_at: null, company_id: 'company_1', reference: null, service_provider_id: null, service_provider_category_id: null, cancelled_at: null, cancellation_reason: null, request_id: null },
      ],
      vacancyRows: [{ propertyId: 'property_a', daysVacant: 66 }],
    });

    expect(rows[0]).toMatchObject({
      propertyId: 'property_a',
      propertyTitle: 'برج النخيل',
      referenceRevenue: 1200,
      occupiedUnits: 3,
      vacantUnits: 2,
      nonRentableUnits: 0,
      collected: 900,
      overdue: 1200,
      expenses: 450,
      maintenanceCost: 250,
      openMaintenanceCount: 1,
      longestVacancyDays: 66,
      priority: 'متابعة فورية',
    });
  });

  it('does not double-count closed maintenance costs already posted as expenses and ignores old costs', () => {
    const rows = buildPropertyPerformanceRows({
      occupancyRows: [{ property: 'برج النخيل', propertyId: 'property_a', shortPropertyId: '', hasTitle: true, occupied: 1, vacant: 0, nonRentable: 0 }],
      contracts: [createContract({ id: 'contract_a', property_id: 'property_a', rent_amount: 1200 })],
      collectionRows: [{ propertyId: 'property_a', propertyTitle: 'برج النخيل', totalPaid: 1000, paymentsCount: 3 }],
      period: { from: '2026-05-01', to: '2026-05-31', asOf: '2026-05-31' },
      overdueRows: [],
      expenseRows: [{ propertyId: 'property_a', propertyTitle: 'برج النخيل', total: 700, count: 1 }],
      maintenanceRows: [
        { id: 'posted-maintenance', no: null, property_id: 'property_a', unit_id: null, title: 'مغسلة', description: null, priority: 'high', status: 'closed', assigned_to: null, cost: 700, charged_to: null, notes: null, request_date: '2026-05-10', scheduled_date: null, work_description: null, technician_name: null, response_time_hours: null, expense_id: 'expense_1', invoice_id: null, reported_by: null, completed_at: '2026-05-12', resolved_at: null, created_at: null, updated_at: null, attachment_url: null, deleted_at: null, company_id: 'company_1', reference: null, service_provider_id: null, service_provider_category_id: null, cancelled_at: null, cancellation_reason: null, request_id: null },
        { id: 'old-unposted-maintenance', no: null, property_id: 'property_a', unit_id: null, title: 'باب', description: null, priority: 'medium', status: 'closed', assigned_to: null, cost: 300, charged_to: null, notes: null, request_date: '2025-12-10', scheduled_date: null, work_description: null, technician_name: null, response_time_hours: null, expense_id: null, invoice_id: null, reported_by: null, completed_at: '2025-12-12', resolved_at: null, created_at: null, updated_at: null, attachment_url: null, deleted_at: null, company_id: 'company_1', reference: null, service_provider_id: null, service_provider_category_id: null, cancelled_at: null, cancellation_reason: null, request_id: null },
      ],
      vacancyRows: [],
    });

    expect(rows[0]).toMatchObject({ expenses: 700, maintenanceCost: 0, openMaintenanceCount: 0 });
  });

  it('counts a request closed after asOf as open historically, without treating its open-row cost as actual cost', () => {
    const rows = buildPropertyPerformanceRows({
      occupancyRows: [{ property: 'برج النخيل', propertyId: 'property_a', shortPropertyId: '', hasTitle: true, occupied: 1, vacant: 0, nonRentable: 0 }],
      contracts: [createContract({ id: 'contract_a', property_id: 'property_a', rent_amount: 1200 })],
      collectionRows: [],
      period: { from: '2026-05-01', to: '2026-05-31', asOf: '2026-05-31' },
      overdueRows: [],
      expenseRows: [],
      maintenanceRows: [
        { id: 'closed-later', no: null, property_id: 'property_a', unit_id: null, title: 'تسريب', description: null, priority: 'high', status: 'closed', assigned_to: null, cost: 500, charged_to: null, notes: null, request_date: '2026-05-20', scheduled_date: null, work_description: null, technician_name: null, response_time_hours: null, expense_id: null, invoice_id: null, reported_by: null, completed_at: '2026-06-05', resolved_at: '2026-06-05', created_at: null, updated_at: null, attachment_url: null, deleted_at: null, company_id: 'company_1', reference: null, service_provider_id: null, service_provider_category_id: null, cancelled_at: null, cancellation_reason: null, request_id: null },
        { id: 'open-with-cost', no: null, property_id: 'property_a', unit_id: null, title: 'معاينة', description: null, priority: 'medium', status: 'open', assigned_to: null, cost: 200, charged_to: null, notes: null, request_date: '2026-05-22', scheduled_date: null, work_description: null, technician_name: null, response_time_hours: null, expense_id: null, invoice_id: null, reported_by: null, completed_at: null, resolved_at: null, created_at: null, updated_at: null, attachment_url: null, deleted_at: null, company_id: 'company_1', reference: null, service_provider_id: null, service_provider_category_id: null, cancelled_at: null, cancellation_reason: null, request_id: null },
      ],
      vacancyRows: [],
    });

    expect(rows[0]).toMatchObject({ openMaintenanceCount: 2, maintenanceCost: 0 });
  });

  it('keeps legacy-cased expiring contracts visible in the renewals window report', () => {
    // Fixture mirrors live data: legacy rows stored as 'ACTIVE'/'ENDED'.
    const rows = buildExpiringContractsRows([
      createContract({ id: 'contract_legacy_active', status: 'ACTIVE' as ContractListItem['status'], end_date: '2026-08-10' }),
      createContract({ id: 'contract_modern_active', end_date: '2026-08-05' }),
      createContract({ id: 'contract_legacy_ended', status: 'ENDED' as ContractListItem['status'], end_date: '2026-08-01' }),
      createContract({ id: 'contract_out_of_window', end_date: '2026-12-31' }),
    ], new Date('2026-07-01T00:00:00'));

    // 60-day window from 2026-07-01 ends 2026-08-30; legacy ENDED is expired, not active.
    expect(rows.map((row) => row.contractId)).toEqual(['contract_modern_active', 'contract_legacy_active']);
  });

  it('labels legacy-cased statuses in the rent roll instead of rendering blanks', () => {
    const labels = { active: 'نشط', draft: 'مسودة', expired: 'منتهي', terminated: 'منهى' } as const;
    const rows = buildRentRollRows([
      createContract({ id: 'contract_legacy_active', status: 'ACTIVE' as ContractListItem['status'] }),
      createContract({ id: 'contract_legacy_ended', status: 'ENDED' as ContractListItem['status'] }),
    ], labels);

    expect(rows.map((row) => row.statusLabel)).toEqual(['نشط', 'منتهي']);
  });

  it('creates receipt print links with the merged query-string route only', () => {
    expect(createReceiptPrintHref('receipt id/42')).toBe('/receipts?receiptId=receipt%20id%2F42');
  });

  it('neutralizes spreadsheet formulas in exported CSV string values', () => {
    expect(escapeCsvValue('=HYPERLINK("https://example.test")')).toBe('"\'=HYPERLINK(\\"https://example.test\\")"');
    expect(escapeCsvValue(' +SUM(1,2)')).toBe('"\' +SUM(1,2)"');
    expect(escapeCsvValue('@tenant')).toBe('"\'@tenant"');
    expect(escapeCsvValue('safe tenant')).toBe('"safe tenant"');
  });

  it('formats report filter dates from the local day instead of UTC serialization', () => {
    const utcDate = new Date('2026-01-01T01:30:00.000Z');
    const localDate = Object.assign(utcDate, {
      getFullYear: () => 2025,
      getMonth: () => 11,
      getDate: () => 31,
    });

    expect(utcDate.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(toDateInputValue(localDate)).toBe('2025-12-31');
  });

  it('builds date-stamped CSV filenames for all report exports', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-16T10:30:00.000Z'));

    expect(buildReportCsvFilename('financial-summary')).toBe('financial-summary-2026-06-16.csv');
    expect(buildReportCsvFilename('rent-roll')).toBe('rent-roll-2026-06-16.csv');
    expect(buildReportCsvFilename('overdue-invoices')).toBe('overdue-invoices-2026-06-16.csv');
    expect(buildReportCsvFilename('aged-receivables')).toBe('aged-receivables-2026-06-16.csv');
    expect(buildReportCsvFilename('daily-collection')).toBe('daily-collection-2026-06-16.csv');
  });
});

describe('Vacancy classification semantics (canonical three-way rule)', () => {
  it('counts maintenance and reserved units as nonRentable, NOT as vacant', () => {
    const rows = buildOccupancyRows([
      { property_id: 'prop_1', status: 'occupied' },
      { property_id: 'prop_1', status: 'available' },
      { property_id: 'prop_1', status: 'maintenance' },
      { property_id: 'prop_1', status: 'reserved' },
    ]);

    expect(rows[0]).toEqual({
      property: 'عقار بدون اسم',
      propertyId: 'prop_1',
      shortPropertyId: '',
      hasTitle: false,
      occupied: 1,
      vacant: 1,
      nonRentable: 2,
    });
  });

  it('only available units are vacant — never counts unknown statuses as vacant', () => {
    const rows = buildOccupancyRows([
      { property_id: 'prop_1', status: 'occupied' },
      { property_id: 'prop_1', status: 'available' },
      { property_id: 'prop_1', status: 'some_custom_status' as any },
    ]);

    expect(rows[0].vacant).toBe(1);
    expect(rows[0].nonRentable).toBe(1);
    expect(rows[0].occupied).toBe(1);
  });

  it('does not inflate vacant count in property performance when maintenance units exist', () => {
    const rows = buildPropertyPerformanceRows({
      occupancyRows: [
        { property: 'Test', propertyId: 'prop_1', shortPropertyId: '', hasTitle: true, occupied: 2, vacant: 1, nonRentable: 3 },
      ],
      contracts: [],
      collectionRows: [],
      period: { from: '2026-05-01', to: '2026-05-31', asOf: '2026-05-31' },
      overdueRows: [],
      expenseRows: [],
      maintenanceRows: [],
      vacancyRows: [],
    });

    expect(rows[0].vacantUnits).toBe(1);
    expect(rows[0].nonRentableUnits).toBe(3);
    expect(rows[0].occupiedUnits).toBe(2);
    // Occupancy rate is calculated over ALL units including nonRentable
    expect(rows[0].occupancyRate).toBeCloseTo(33.33, 1);
  });
});
