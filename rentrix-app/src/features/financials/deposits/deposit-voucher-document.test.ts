import { describe, expect, it, vi } from 'vitest';
import {
  toDepositVoucherPayload,
  printDepositVoucher,
  downloadDepositVoucherPdf,
} from './deposit-voucher-document';
import { documentService } from '@/services/documents/DocumentService';
import type { DepositRecord } from './deposit-service';

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

const mockDeposit: DepositRecord = {
  id: 'dep-01',
  contract_id: 'cnt-01',
  tenant_name: 'خالد السعدي',
  property_title: 'برج الأمل',
  unit_number: '204',
  deposit_type: 'security',
  total_held: 300,
  total_claimed: 50,
  total_refunded: 0,
  remaining_amount: 250,
  notes: 'وديعة ضمان مسددة بالكامل',
} as unknown as DepositRecord;

describe('deposit-voucher-document adapter', () => {
  it('#6 maps deposit voucher payload accurately from canonical DepositRecord', () => {
    const payload = toDepositVoucherPayload({
      deposit: mockDeposit,
      transactionKind: 'received',
      amount: 300,
      transactionDate: '2026-01-01',
      reference: 'DEP-RCV-001',
    });

    expect(payload.transactionKind).toBe('received');
    expect(payload.amount).toBe(300);
    expect(payload.tenantName).toBe('خالد السعدي');
    expect(payload.propertyTitle).toBe('برج الأمل');
    expect(payload.unitNumber).toBe('204');
    expect(payload.depositBalance).toBe(250);
  });

  it('delegates print and download actions to documentService', async () => {
    await printDepositVoucher({
      deposit: mockDeposit,
      transactionKind: 'received',
      amount: 300,
      transactionDate: '2026-01-01',
      settings: validSettings,
    });

    expect(documentService.printDocument).toHaveBeenCalledWith('deposit_voucher', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ amount: 300 }),
    }));

    await downloadDepositVoucherPdf({
      deposit: mockDeposit,
      transactionKind: 'returned',
      amount: 250,
      transactionDate: '2026-12-31',
      settings: validSettings,
    });

    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('deposit_voucher', expect.objectContaining({
      settings: validSettings,
      payload: expect.objectContaining({ amount: 250 }),
    }));
  });
});
