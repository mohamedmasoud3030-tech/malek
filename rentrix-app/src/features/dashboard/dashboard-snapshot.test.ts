import { describe, expect, it } from 'vitest';
import {
  calculateOccupancyRate,
  createDashboardPeriod,
  summarizeDashboardArrearsMetrics,
  summarizeDashboardFinancialMetrics,
  summarizeDashboardOperationalMetrics,
} from './dashboard-snapshot';
import type { DashboardOverview } from './dashboard-service';
import type { AgedReceivablesReport, ArrearsSummaryReport, OverdueInvoicesReport } from '@/features/financials/reports/financialReportsService';
import type { ContractListItem } from '@/features/contracts/services/contractService';

const emptyAgedReceivables: AgedReceivablesReport = {
  asOf: '2026-05-18',
  buckets: {
    current: { key: 'current', label: 'Current', total: 0, invoiceCount: 0 },
    days_1_30: { key: 'days_1_30', label: '1-30', total: 25, invoiceCount: 1 },
    days_31_60: { key: 'days_31_60', label: '31-60', total: 0, invoiceCount: 0 },
    days_61_90: { key: 'days_61_90', label: '61-90', total: 0, invoiceCount: 0 },
    days_90_plus: { key: 'days_90_plus', label: '90+', total: 0, invoiceCount: 0 },
  },
  totalOutstanding: 25,
  totalOverdue: 25,
  rows: [],
};

describe('dashboard snapshot helpers', () => {
  it('creates the current dashboard month period from a date', () => {
    expect(createDashboardPeriod(new Date(2026, 4, 18))).toEqual({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-18',
      asOf: '2026-05-18',
      month: 5,
      year: 2026,
    });
  });

  it('calculates safe occupancy percentages', () => {
    expect(calculateOccupancyRate(10, 3)).toBe(70);
    expect(calculateOccupancyRate(0, 0)).toBe(0);
    expect(calculateOccupancyRate(5, 99)).toBe(0);
  });

  it('maps financial period summaries to dashboard metrics without new math', () => {
    expect(summarizeDashboardFinancialMetrics({
      invoiced: 1000,
      paid: 650,
      outstanding: 350,
      expenses: 125,
      netCash: 525,
      invoicesCount: 4,
      paymentsCount: 3,
      expensesCount: 2,
    })).toEqual({
      rentDue: 1000,
      collectedRent: 650,
      outstandingRent: 350,
      expenses: 125,
      netPosition: 525,
      invoicesCount: 4,
      paymentsCount: 3,
      expensesCount: 2,
    });
  });

  it('summarizes operational counts with active contract fallback', () => {
    const overview: DashboardOverview = {
      financial: {
        total_collected: 0,
        total_overdue_invoices: 0,
        total_expenses: 0,
        net_revenue: 0,
      },
      operational: {
        properties: 2,
        units: 8,
        activeContracts: 4,
        expiringContracts30Days: 1,
        vacantUnits: 3,
        overdueInvoices: 2,
      },
    };

    expect(summarizeDashboardOperationalMetrics(overview, [] as ContractListItem[])).toMatchObject({
      properties: 2,
      units: 8,
      activeContracts: 4,
      expiringContracts30Days: 1,
      vacantUnits: 3,
      occupiedUnits: 5,
      occupancyRate: 63,
    });
  });

  it('summarizes arrears metrics from existing arrears reports', () => {
    const overdueInvoices: OverdueInvoicesReport = {
      asOf: '2026-05-18',
      totalOverdue: 300,
      invoiceCount: 2,
      rows: [{
        invoiceId: 'invoice-1',
        shortInvoiceId: 'invoice-',
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        tenantName: 'Tenant',
        propertyId: 'property-1',
        propertyTitle: 'Property',
        unitId: 'unit-1',
        unitNumber: '101',
        dueDate: '2026-05-01',
        daysOverdue: 17,
        amount: 400,
        paidAmount: 100,
        remainingAmount: 300,
        status: 'overdue',
      }],
    };
    const arrearsSummary: ArrearsSummaryReport = {
      asOf: '2026-05-18',
      totalOverdue: 300,
      overdueInvoiceCount: 2,
      over90Amount: 50,
      over90InvoiceCount: 1,
      averageDaysOverdue: 17,
    };

    expect(summarizeDashboardArrearsMetrics({
      overdueInvoices,
      arrearsSummary,
      agedReceivables: emptyAgedReceivables,
    })).toMatchObject({
      totalOverdue: 300,
      overdueInvoiceCount: 2,
      averageDaysOverdue: 17,
      over90Amount: 50,
      over90InvoiceCount: 1,
      overdueInvoices: overdueInvoices.rows,
    });
  });
});
