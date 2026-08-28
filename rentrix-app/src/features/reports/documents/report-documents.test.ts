import { describe, expect, it, vi } from 'vitest';
import {
  toAgedArrearsPayload,
  toVatStatementPayload,
  toPortfolioPerformancePayload,
  toVacancyLossPayload,
  toRentRollPayload,
  printAgedArrearsReport,
  printVatStatementReport,
  printRentRollReport,
} from './report-documents';
import { documentService } from '@/services/documents/DocumentService';
import type { AgedReceivablesReport } from '@/features/financials/reports/arrears-reports-service';
import type { VatReturnReport } from '@/features/financials/reports/financial-statements-service';
import type { OccupancyChartRow, RentRollReportRow } from '../reports-page.helpers';

vi.mock('@/services/documents/DocumentService', () => ({
  documentService: {
    printDocument: vi.fn().mockResolvedValue(undefined),
    downloadDocumentPdf: vi.fn().mockResolvedValue(undefined),
  },
}));

const validSettings = {
  companyName: 'شركة مسار العقارية',
  crNumber: '12345678',
  taxNumber: 'OM12345678',
  currency: 'OMR',
  city: 'مسقط',
};

describe('report-documents adapters', () => {
  it('#7 maps aged receivables report to generic_report without recalculating balances', () => {
    const mockAgedReport: AgedReceivablesReport = {
      asOf: '2026-02-28',
      totalOutstanding: 1500,
      totalOverdue: 1000,
      buckets: {
        current: { key: 'current', label: 'غير متأخر', total: 500, invoiceCount: 1 },
        days_1_30: { key: 'days_1_30', label: '1–30 يوم', total: 300, invoiceCount: 1 },
        days_31_60: { key: 'days_31_60', label: '31–60 يوم', total: 200, invoiceCount: 1 },
        days_61_90: { key: 'days_61_90', label: '61–90 يوم', total: 500, invoiceCount: 1 },
        days_90_plus: { key: 'days_90_plus', label: 'أكثر من 90 يوم', total: 0, invoiceCount: 0 },
      },
      rows: [
        {
          contractId: 'c-01',
          tenantId: 't-01',
          tenantName: 'سالم الكعبي',
          propertyId: 'p-01',
          propertyTitle: 'برج الشروق',
          unitId: 'u-01',
          unitNumber: '101',
          totalOutstanding: 1500,
          totalOverdue: 1000,
          invoiceCount: 4,
          buckets: {
            current: { key: 'current', label: 'غير متأخر', total: 500, invoiceCount: 1 },
            days_1_30: { key: 'days_1_30', label: '1–30 يوم', total: 300, invoiceCount: 1 },
            days_31_60: { key: 'days_31_60', label: '31–60 يوم', total: 200, invoiceCount: 1 },
            days_61_90: { key: 'days_61_90', label: '61–90 يوم', total: 500, invoiceCount: 1 },
            days_90_plus: { key: 'days_90_plus', label: 'أكثر من 90 يوم', total: 0, invoiceCount: 0 },
          },
        },
      ],
    };

    const payload = toAgedArrearsPayload(mockAgedReport);
    expect(payload.reportType).toBe('Aged_Arrears_Report');
    expect(payload.periodTo).toBe('2026-02-28');
    expect(payload.sections[0].rows).toHaveLength(1);
    expect(payload.sections[0].rows[0][0]).toBe('سالم الكعبي');
    expect(payload.sections[0].rows[0][7]).toBe('1500');
  });

  it('#9 maps VAT return report to generic_report structure', () => {
    const mockVat: VatReturnReport = {
      period: { from: '2026-01-01', to: '2026-03-31' },
      totalSalesAmount: 50000,
      totalTaxAmount: 2500,
      invoiceCount: 25,
    };

    const payload = toVatStatementPayload(mockVat);
    expect(payload.reportType).toBe('VAT_Return_Statement');
    expect(payload.periodFrom).toBe('2026-01-01');
    expect(payload.periodTo).toBe('2026-03-31');
    expect(payload.sections[0].rows).toHaveLength(3);
    expect(payload.sections[0].rows[0][1]).toBe('50000');
    expect(payload.sections[0].rows[1][1]).toBe('2500');
  });

  it('#12 maps portfolio performance occupancy rows to generic_report', () => {
    const mockOccupancy: OccupancyChartRow[] = [
      { property: 'برج الشروق', propertyId: 'p-1', shortPropertyId: 'p-1', hasTitle: true, occupied: 8, vacant: 2 },
      { property: 'مجمع الواحة', propertyId: 'p-2', shortPropertyId: 'p-2', hasTitle: true, occupied: 10, vacant: 0 },
    ];

    const payload = toPortfolioPerformancePayload({
      occupancyRows: mockOccupancy,
      periodFrom: '2026-01-01',
      periodTo: '2026-12-31',
    });

    expect(payload.reportType).toBe('Portfolio_Performance_Report');
    expect(payload.sections[0].rows).toHaveLength(2);
    expect(payload.sections[0].rows[0][0]).toBe('برج الشروق');
    expect(payload.sections[0].rows[0][1]).toBe('8');
    expect(payload.sections[0].rows[0][2]).toBe('2');
    expect(payload.sections[0].rows[0][4]).toBe('80%');
  });

  it('#14 maps vacancy loss items correctly', () => {
    const payload = toVacancyLossPayload({
      items: [
        { propertyTitle: 'برج الشروق', unitNumber: '102', unitType: 'شقة', marketRent: 400, daysVacant: 45, estimatedLoss: 600 },
      ],
      asOf: '2026-02-28',
    });

    expect(payload.reportType).toBe('Vacancy_Loss_Assessment');
    expect(payload.periodTo).toBe('2026-02-28');
    expect(payload.sections[0].rows).toHaveLength(1);
    expect(payload.sections[0].rows[0][5]).toBe('600');
  });

  it('#18 maps rent roll report rows without mutating amounts', () => {
    const mockRentRoll: RentRollReportRow[] = [
      {
        contractId: 'c-01',
        contractReference: 'CNT-01',
        tenantName: 'فيصل العجمي',
        propertyTitle: 'برج الصفا',
        unitNumber: '401',
        rentAmount: 600,
        paymentCycle: 'شهري',
        statusLabel: 'نشط',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ];

    const payload = toRentRollPayload({
      rows: mockRentRoll,
      asOf: '2026-02-28',
      propertyFilterLabel: 'برج الصفا',
    });

    expect(payload.reportType).toBe('Rent_Roll_Statement');
    expect(payload.periodTo).toBe('2026-02-28');
    expect(payload.sections[0].rows[0][0]).toBe('فيصل العجمي');
    expect(payload.sections[0].rows[0][3]).toBe('600');
  });

  it('delegates print actions to documentService with generic_report type', async () => {
    const mockAgedReport: AgedReceivablesReport = {
      asOf: '2026-02-28',
      totalOutstanding: 0,
      totalOverdue: 0,
      buckets: {
        current: { key: 'current', label: 'غير متأخر', total: 0, invoiceCount: 0 },
        days_1_30: { key: 'days_1_30', label: '1–30 يوم', total: 0, invoiceCount: 0 },
        days_31_60: { key: 'days_31_60', label: '31–60 يوم', total: 0, invoiceCount: 0 },
        days_61_90: { key: 'days_61_90', label: '61–90 يوم', total: 0, invoiceCount: 0 },
        days_90_plus: { key: 'days_90_plus', label: 'أكثر من 90 يوم', total: 0, invoiceCount: 0 },
      },
      rows: [],
    };

    await printAgedArrearsReport({ report: mockAgedReport, settings: validSettings });
    expect(documentService.printDocument).toHaveBeenCalledWith('generic_report', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ reportType: 'Aged_Arrears_Report' }),
    }));
  });
});
