import { describe, expect, it, vi } from 'vitest';
import {
  toMaintenanceWorkOrderPayload,
  toMaintenanceCompletionPayload,
  printMaintenanceWorkOrder,
  downloadMaintenanceWorkOrderPdf,
  printMaintenanceCompletion,
  downloadMaintenanceCompletionPdf,
} from './maintenance-documents';
import { documentService } from '@/services/documents/DocumentService';
import type { Maintenance } from '../maintenance-service';

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

const mockMaintenance: Maintenance = {
  id: 'm-01',
  no: 'MNT-001',
  title: 'إصلاح تسريب مياه الحمام',
  description: 'تسريب تحت المغسلة يحتاج إلى استبدال المحبس',
  priority: 'high',
  status: 'in_progress',
  assigned_to: 'tech-01',
  technician_name: 'علي الفني',
  cost: 45,
  charged_to: 'owner',
  scheduled_date: '2026-02-15',
  created_at: '2026-02-14T08:00:00Z',
  company_id: 'c-01',
  property_id: 'p-01',
  unit_id: 'u-01',
  attachment_url: 'https://example.com/leak.jpg',
} as unknown as Maintenance;

describe('maintenance-documents adapters', () => {
  it('#19 maps maintenance work order payload directly from record', () => {
    const payload = toMaintenanceWorkOrderPayload({
      maintenance: mockMaintenance,
      propertyTitle: 'برج الشروق',
      unitNumber: '302',
      responsibleParty: 'المالك',
      instructions: 'يرجى التنسيق مع المستأجر قبل الزيارة',
    });

    expect(payload.title).toBe('إصلاح تسريب مياه الحمام');
    expect(payload.status).toBe('in_progress');
    expect(payload.priority).toBe('high');
    expect(payload.propertyTitle).toBe('برج الشروق');
    expect(payload.unitNumber).toBe('302');
    expect(payload.technicianName).toBe('علي الفني');
    expect(payload.approvedEstimate).toBe(45);
    expect(payload.instructions).toBe('يرجى التنسيق مع المستأجر قبل الزيارة');
  });

  it('#20 maps maintenance completion certificate payload accurately', () => {
    const payload = toMaintenanceCompletionPayload({
      maintenance: mockMaintenance,
      propertyTitle: 'برج الشروق',
      unitNumber: '302',
      completionDate: '2026-02-16',
      workPerformed: 'تم استبدال المحبس واختبار ضغط المياه بنجاح',
      tenantAccepted: true,
      managerAccepted: true,
    });

    expect(payload.completionDate).toBe('2026-02-16');
    expect(payload.workPerformed).toBe('تم استبدال المحبس واختبار ضغط المياه بنجاح');
    expect(payload.approvedFinalCost).toBe(45);
    expect(payload.tenantAccepted).toBe(true);
    expect(payload.managerAccepted).toBe(true);
    expect(payload.evidenceRefs).toEqual(['https://example.com/leak.jpg']);
  });

  it('delegates work order and completion printing/download to documentService', async () => {
    await printMaintenanceWorkOrder({
      maintenance: mockMaintenance,
      settings: validSettings,
    });
    expect(documentService.printDocument).toHaveBeenCalledWith('maintenance_work_order', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ title: 'إصلاح تسريب مياه الحمام' }),
    }));

    await downloadMaintenanceCompletionPdf({
      maintenance: mockMaintenance,
      settings: validSettings,
    });
    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('maintenance_completion', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ title: 'إصلاح تسريب مياه الحمام' }),
    }));
  });
});