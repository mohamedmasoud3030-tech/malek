import { describe, expect, it, vi } from 'vitest';
import {
  toUtilitySplitPayload,
  printUtilitySplit,
  downloadUtilitySplitPdf,
} from './utility-split-document';
import { documentService } from '@/services/documents/DocumentService';
import type { UtilityObligation, UtilityObligationsSummary } from '../utility-obligations';

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
  documentPrefixes: {},
};

const mockObligations: UtilityObligation[] = [
  {
    billId: 'b-01',
    billNumber: 'ELEC-2026-01',
    propertyId: 'p-01',
    unitId: 'u-01',
    meterId: 'm-01',
    dueDate: '2026-02-28',
    amount: 80,
    paidAmount: 20,
    remainingAmount: 60,
    responsibleParty: 'tenant',
    urgency: 'overdue',
    daysOverdue: 5,
    daysUntilDue: -5,
  },
  {
    billId: 'b-02',
    billNumber: 'WATER-2026-01',
    propertyId: 'p-01',
    unitId: 'u-01',
    meterId: 'm-02',
    dueDate: '2026-03-15',
    amount: 30,
    paidAmount: 30,
    remainingAmount: 0,
    responsibleParty: 'landlord',
    urgency: 'settled',
    daysOverdue: 0,
    daysUntilDue: 10,
  },
];

const mockSummary: UtilityObligationsSummary = {
  overdueCount: 1,
  overdueAmount: 60,
  dueSoonCount: 0,
  dueSoonAmount: 0,
  outstandingCount: 1,
  outstandingAmount: 60,
  remainingByResponsibleParty: {
    tenant: 60,
    landlord: 0,
    company: 0,
  },
};

describe('utility-split-document adapter', () => {
  it('#22 maps utility obligations into generic_report payload without recalculation', () => {
    const payload = toUtilitySplitPayload({
      obligations: mockObligations,
      summary: mockSummary,
      propertyTitle: 'برج الشروق',
    });

    expect(payload.reportType).toBe('Utility_CAM_Split_Sheet');
    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0].rows).toHaveLength(2);
    expect(payload.sections[0].rows[0][0]).toBe('ELEC-2026-01');
    expect(payload.sections[0].rows[0][1]).toBe('المستأجر');
    expect(payload.sections[0].rows[0][2]).toBe('80');
    expect(payload.sections[0].rows[0][4]).toBe('60');
    expect(payload.totalSummary).toContain('إجمالي المستحق القائم: 60');
  });

  it('delegates print and download actions to documentService with generic_report type', async () => {
    await printUtilitySplit({
      obligations: mockObligations,
      settings: validSettings,
      summary: mockSummary,
    });

    expect(documentService.printDocument).toHaveBeenCalledWith('generic_report', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ reportType: 'Utility_CAM_Split_Sheet' }),
    }));

    await downloadUtilitySplitPdf({
      obligations: mockObligations,
      settings: validSettings,
      summary: mockSummary,
    });

    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('generic_report', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ reportType: 'Utility_CAM_Split_Sheet' }),
    }));
  });
});