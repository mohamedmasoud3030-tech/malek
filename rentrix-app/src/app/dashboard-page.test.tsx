import { describe, expect, it } from 'vitest';
import { buildDashboardSummaryCards } from './dashboard/dashboard-summary-cards';
import { buildOverdueTenantRows } from './dashboard/dashboard.utils';
import type { DashboardSnapshot } from './dashboardSnapshot';
import { useCompanyFormattersWith, formatMoney } from '@/hooks/useCompanyFormatters';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';

const formatters = useCompanyFormattersWith(defaultCompanySettingsContract);

const snapshot = {
  financial: {
    rentDue: 1200,
    collectedRent: 900,
    outstandingRent: 300,
    expenses: 125,
    netPosition: 775,
    invoicesCount: 4,
    paymentsCount: 3,
    expensesCount: 2,
  },
  operational: {
    properties: 2,
    units: 10,
    activeContracts: 7,
    expiringContracts30Days: 2,
    vacantUnits: 3,
    occupiedUnits: 7,
    occupancyRate: 70,
  },
} as DashboardSnapshot;

describe('buildDashboardSummaryCards', () => {
  it('maps dashboard snapshot metrics into summary cards with company-aware formatted money', () => {
    const cards = buildDashboardSummaryCards(snapshot, formatters);

    expect(cards.map((card) => card.title)).toEqual([
      'الإيجار المستحق',
      'المحصل هذا الشهر',
      'الرصيد المتبقي',
      'المصروفات',
      'المحصل بعد المصروفات',
      'الإشغال',
      'تنتهي خلال 30 يوم',
    ]);
    expect(cards.map((card) => card.value)).toEqual([
      '‏١٬٢٠٠٫٠٠٠ OMR',
      '‏٩٠٠٫٠٠٠ OMR',
      '‏٣٠٠٫٠٠٠ OMR',
      '‏١٢٥٫٠٠٠ OMR',
      '‏٧٧٥٫٠٠٠ OMR',
      '70%',
      2,
    ]);
    expect(cards.filter((card) => card.isMoney)).toHaveLength(5);
  });

  it('falls back to zero metrics when the snapshot is not loaded yet', () => {
    const cards = buildDashboardSummaryCards(undefined, formatters);

    expect(cards.map((card) => card.value)).toEqual([
      '‏٠٫٠٠٠ OMR',
      '‏٠٫٠٠٠ OMR',
      '‏٠٫٠٠٠ OMR',
      '‏٠٫٠٠٠ OMR',
      '‏٠٫٠٠٠ OMR',
      '0%',
      0,
    ]);
  });
});

describe('buildOverdueTenantRows', () => {
  it('maps overdue invoices into sorted read-only tenant rows', () => {
    const rows: OverdueInvoiceReportRow[] = [
      {
        invoiceId: 'invoice-low',
        shortInvoiceId: 'invoice-',
        contractId: 'contract-1',
        tenantId: null,
        tenantName: null,
        propertyId: 'property-1',
        propertyTitle: null,
        unitId: null,
        unitNumber: null,
        dueDate: '2026-05-10',
        daysOverdue: 8,
        amount: 100,
        paidAmount: 25,
        remainingAmount: 75,
        status: 'overdue',
      },
      {
        invoiceId: 'invoice-high',
        shortInvoiceId: 'invoice-',
        contractId: 'contract-2',
        tenantId: 'tenant-2',
        tenantName: 'شركة الاختبار',
        propertyId: 'property-2',
        propertyTitle: 'برج الاختبار',
        unitId: 'unit-2',
        unitNumber: '12',
        dueDate: '2026-05-01',
        daysOverdue: 17,
        amount: 500,
        paidAmount: 100,
        remainingAmount: 400,
        status: 'overdue',
      },
    ];

    expect(buildOverdueTenantRows(rows)).toEqual([
      {
        invoiceId: 'invoice-high',
        tenantName: 'شركة الاختبار',
        location: 'برج الاختبار / وحدة 12',
        dueDate: '2026-05-01',
        daysOverdue: 17,
        remainingAmount: 400,
      },
      {
        invoiceId: 'invoice-low',
        tenantName: 'مستأجر غير محدد',
        location: 'عقار غير محدد',
        dueDate: '2026-05-10',
        daysOverdue: 8,
        remainingAmount: 75,
      },
    ]);
  });
});
