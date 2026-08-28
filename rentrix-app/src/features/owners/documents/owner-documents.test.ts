import { describe, expect, it, vi } from 'vitest';
import {
  toOwnerSettlementPayload,
  toManagementExitPayload,
  printOwnerSettlement,
  downloadOwnerSettlementPdf,
  printManagementExit,
  downloadManagementExitPdf,
} from './owner-documents';
import { documentService } from '@/services/documents/DocumentService';
import type { OwnerSettlementRecord } from '../services/owner-settlements-service';

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

const mockSettlement: OwnerSettlementRecord = {
  id: 'stl-01',
  owner_id: 'o-01',
  owner_name: 'محمد البلوشي',
  property_id: 'p-01',
  property_title: 'بناية النهضة',
  period_start: '2026-01-01',
  period_end: '2026-01-31',
  status: 'settled',
  gross_rent_collected: 1500,
  management_fee_amount: 75,
  owner_expenses: 200,
  net_payable_amount: 1225,
  payout_reference: 'TRF-2026-001',
  paid_at: '2026-02-05T12:00:00Z',
  notes: 'تسوية شهر يناير معتمدة ومسددة',
} as unknown as OwnerSettlementRecord;

describe('owner-documents adapters', () => {
  it('#11 maps owner settlement payload directly from canonical settlement record', () => {
    const payload = toOwnerSettlementPayload({
      settlement: mockSettlement,
      reference: 'SETTLE-2026-01',
      supportingRows: [
        { description: 'إيجار شقة 101', amount: 500, type: 'credit' },
        { description: 'إصلاح سباكة', amount: 50, type: 'debit' },
      ],
    });

    expect(payload.reference).toBe('SETTLE-2026-01');
    expect(payload.ownerName).toBe('محمد البلوشي');
    expect(payload.collectedOwnerFunds).toBe(1500);
    expect(payload.managementFee).toBe(75);
    expect(payload.ownerExpenses).toBe(200);
    expect(payload.netDue).toBe(1225);
    expect(payload.payoutReference).toBe('TRF-2026-001');
    expect(payload.supportingRows).toHaveLength(2);
  });

  it('#13 maps management exit payload with complete handoff checklist', () => {
    const payload = toManagementExitPayload({
      ownerName: 'محمد البلوشي',
      propertyTitle: 'بناية النهضة',
      exitDate: '2026-12-31',
      agreementEndDate: '2026-12-31',
      status: 'completed',
      keysHandover: [{ item: 'مفاتيح الشقق والبوابات', quantity: 15, note: 'تم التسليم كاملة' }],
      documentsHandover: [{ item: 'ملفات العقود والضمانات', quantity: 5, note: 'نسخ أصلية' }],
      outstandingSettlementNote: 'تمت تصفية كافة المستحقات المالية للمالك',
      notes: 'تم إنهاء العقد بالتراضي',
    });

    expect(payload.ownerName).toBe('محمد البلوشي');
    expect(payload.propertyTitle).toBe('بناية النهضة');
    expect(payload.status).toBe('completed');
    expect(payload.keysHandover?.[0].quantity).toBe(15);
    expect(payload.documentsHandover?.[0].quantity).toBe(5);
    expect(payload.outstandingSettlementNote).toBe('تمت تصفية كافة المستحقات المالية للمالك');
  });

  it('delegates printing and PDF download to documentService with guarded readiness', async () => {
    await printOwnerSettlement({
      settlement: mockSettlement,
      settings: validSettings,
    });
    expect(documentService.printDocument).toHaveBeenCalledWith('owner_settlement', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ ownerName: 'محمد البلوشي' }),
    }));

    await downloadManagementExitPdf({
      ownerName: 'محمد البلوشي',
      propertyTitle: 'بناية النهضة',
      settings: validSettings,
      exitDate: '2026-12-31',
      status: 'completed',
    });
    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('management_exit', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ ownerName: 'محمد البلوشي' }),
    }));
  });
});