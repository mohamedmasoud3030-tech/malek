import { describe, expect, it, vi } from 'vitest';
import {
  toUnitPassportPayload,
  printUnitPassport,
  downloadUnitPassportPdf,
} from './unit-passport-document';
import { documentService } from '@/services/documents/DocumentService';
import type { Unit } from '@/types/domain';

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

const mockUnit: Pick<Unit, 'unit_number' | 'status'> & { unit_type?: string | null; notes?: string | null } = {
  unit_number: '501',
  status: 'vacant',
  unit_type: 'شقة سكنية - غرفتين',
  notes: 'مجددة بالكامل في يناير 2026',
};

describe('unit-passport-document adapter', () => {
  it('#15 maps unit passport payload from unit and lifecycle projections', () => {
    const payload = toUnitPassportPayload({
      unit: mockUnit,
      propertyTitle: 'برج الشروق',
      leaseHistory: [
        { tenantName: 'أحمد الحارثي', startDate: '2025-01-01', endDate: '2025-12-31', status: 'منتهي', rentAmount: 450 },
      ],
      maintenanceHistory: [
        { date: '2025-06-15', title: 'صيانة مكيف', status: 'مكتملة', cost: 35 },
      ],
      utilitySummary: 'كهرباء: 10452 | مياه: 8821',
      financialSummaryNote: 'متوسط العائد السنوي: 5,400 ر.ع',
    });

    expect(payload.unitNumber).toBe('501');
    expect(payload.propertyTitle).toBe('برج الشروق');
    expect(payload.currentStatus).toBe('vacant');
    expect(payload.unitType).toBe('شقة سكنية - غرفتين');
    expect(payload.leaseHistory).toHaveLength(1);
    expect(payload.maintenanceHistory).toHaveLength(1);
    expect(payload.utilitySummary).toBe('كهرباء: 10452 | مياه: 8821');
  });

  it('delegates printing and downloading to documentService', async () => {
    await printUnitPassport({
      unit: mockUnit,
      settings: validSettings,
      propertyTitle: 'برج الشروق',
    });

    expect(documentService.printDocument).toHaveBeenCalledWith('unit_passport', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ unitNumber: '501' }),
    }));

    await downloadUnitPassportPdf({
      unit: mockUnit,
      settings: validSettings,
      propertyTitle: 'برج الشروق',
    });

    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('unit_passport', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ unitNumber: '501' }),
    }));
  });
});
