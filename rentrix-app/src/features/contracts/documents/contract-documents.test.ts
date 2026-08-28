import { describe, expect, it, vi } from 'vitest';
import {
  toLeaseSummaryPayload,
  toUnitInspectionPayload,
  toLeaseNoticePayload,
  toTenantClearancePayload,
  toLegalDossierPayload,
  printLeaseSummary,
  downloadLeaseSummaryPdf,
} from './contract-documents';
import { documentService } from '@/services/documents/DocumentService';
import type { ContractDetail } from '../services/contractService';
import type { ContractInspection } from '../evidence/contract-evidence-service';

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

const mockContract: ContractDetail = {
  id: 'c-01',
  reference: 'CNT-2026-001',
  status: 'active',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  rent_amount: 500,
  payment_cycle: 'monthly',
  notes: 'عقد سكني عادي',
  properties: { id: 'p-01', title: 'برج الياسمين' },
  units: { id: 'u-01', unit_number: '101' },
  people: { id: 't-01', full_name: 'أحمد الحارثي', phone: '96891234567', national_id: '12345678' },
} as unknown as ContractDetail;

describe('contract-documents adapters', () => {
  it('#1 maps lease summary payload from contract verbatim', () => {
    const payload = toLeaseSummaryPayload(mockContract);
    expect(payload.reference).toBe('CNT-2026-001');
    expect(payload.status).toBe('active');
    expect(payload.rentAmount).toBe(500);
    expect(payload.tenantName).toBe('أحمد الحارثي');
    expect(payload.propertyTitle).toBe('برج الياسمين');
    expect(payload.unitNumber).toBe('101');
  });

  it('#2 maps unit inspection snagging payload from inspection checklist', () => {
    const mockInspection: ContractInspection = {
      id: 'ins-01',
      kind: 'MOVE_IN',
      status: 'REVIEWED',
      inspected_on: '2026-01-02',
      checklist: [
        { code: 'DOORS', condition: 'GOOD', note: 'الأبواب سليمة' },
        { code: 'WALLS', condition: 'DAMAGED', note: 'خدوش بالجدار' },
      ],
      meter_readings: { electricity: '1234.5', water: '567.8' },
      keys_and_access: { key_count: 3, notes: '3 مفاتيح رئيسية' },
      summary: 'فحص دخول شامل',
    } as unknown as ContractInspection;

    const payload = toUnitInspectionPayload({
      inspection: mockInspection,
      contract: mockContract,
      inspectorName: 'سعيد المهندس',
    });

    expect(payload.inspectionMode).toBe('move_in');
    expect(payload.conditionRows).toHaveLength(2);
    expect(payload.conditionRows[0].condition).toBe('سليم / ممتاز');
    expect(payload.conditionRows[1].condition).toBe('تالف / متضرر');
    expect(payload.meterReadings).toHaveLength(2);
    expect(payload.keyHandover?.[0].quantity).toBe(3);
    expect(payload.inspectorName).toBe('سعيد المهندس');
  });

  it('#2 throws if inspection has empty checklist', () => {
    const emptyInspection: ContractInspection = {
      id: 'ins-02',
      kind: 'MOVE_IN',
      status: 'DRAFT',
      checklist: [],
    } as unknown as ContractInspection;

    expect(() =>
      toUnitInspectionPayload({
        inspection: emptyInspection,
        contract: mockContract,
      }),
    ).toThrow(/لا يمكن إصدار محضر الفحص/);
  });

  it('#3 maps lease notice payload correctly', () => {
    const payload = toLeaseNoticePayload({
      contract: mockContract,
      noticeKind: 'renewal',
      noticeDate: '2026-11-01',
      effectiveDate: '2026-12-31',
      approvedMessage: 'يرجى تجديد العقد قبل نهايته.',
    });

    expect(payload.noticeKind).toBe('renewal');
    expect(payload.noticeDate).toBe('2026-11-01');
    expect(payload.tenantName).toBe('أحمد الحارثي');
  });

  it('#10 maps tenant clearance and blocks cleared status with outstanding debt', () => {
    expect(() =>
      toTenantClearancePayload({
        contract: mockContract,
        clearanceDate: '2026-12-31',
        clearanceStatus: 'cleared',
        outstandingAmount: 150,
      }),
    ).toThrow(/لا يمكن إصدار شهادة براءة ذمة نهائية مع وجود مبالغ معلقة/);

    const validPayload = toTenantClearancePayload({
      contract: mockContract,
      clearanceDate: '2026-12-31',
      clearanceStatus: 'cleared',
      outstandingAmount: 0,
      depositDisposition: 'تمت إعادة الوديعة بالكامل',
      depositAmount: 500,
    });
    expect(validPayload.clearanceStatus).toBe('cleared');
    expect(validPayload.depositAmount).toBe(500);
  });

  it('#24 maps legal dossier payload and requires timeline events', () => {
    expect(() =>
      toLegalDossierPayload({
        contract: mockContract,
        timelineEvents: [],
      }),
    ).toThrow(/لا يمكن إصدار ملف النزاع القانوني بدون وقائع/);

    const payload = toLegalDossierPayload({
      contract: mockContract,
      timelineEvents: [
        { date: '2026-03-01', eventType: 'تخلف عن السداد', description: 'لم يسدد إيجار شهر مارس' },
        { date: '2026-03-15', eventType: 'إنذار قانوني', description: 'إرسال إشعار السداد الأول' },
      ],
      totalArrearsAmount: 1000,
      caseStatus: 'قيد الترافع',
    });
    expect(payload.timelineEvents).toHaveLength(2);
    expect(payload.totalArrearsAmount).toBe(1000);
  });

  it('guarded print and download actions delegate to documentService with complete company identity', async () => {
    await printLeaseSummary(mockContract, validSettings);
    expect(documentService.printDocument).toHaveBeenCalledWith('contract', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ reference: 'CNT-2026-001' }),
    }));

    await downloadLeaseSummaryPdf(mockContract, validSettings);
    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('contract', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ reference: 'CNT-2026-001' }),
    }));
  });
});