import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportContractPdf, printContractView } from './contractDetailActions';
import type { DocumentCompanySettings } from '@/services/documents/companyIdentity';
import type { ContractDetail } from '../services/contractService';

vi.mock('@/services/documents/DocumentService', () => ({
  documentService: {
    printDocument: vi.fn(async () => undefined),
    downloadDocumentPdf: vi.fn(async () => undefined),
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/services/action-service', () => ({ openWhatsApp: vi.fn(), shareOrCopy: vi.fn(async () => 'copied') }));

const { documentService } = await import('@/services/documents/DocumentService');

const settings = {
  companyName: 'Rentrix LLC',
  currency: 'OMR',
  documentPrefixes: {},
} as DocumentCompanySettings;

const contract = {
  id: 'contract-12345678',
  status: 'active',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  rent_amount: 1000,
  payment_cycle: 'monthly',
  notes: 'شرط خاص',
  property_id: 'property-1',
  tenant_id: 'tenant-1',
  unit_id: 'unit-1',
  people: { id: 'tenant-1', full_name: 'أحمد علي', phone: '9000', email: 'tenant@example.test', national_id: 'ID-1' },
  properties: { id: 'property-1', title: 'برج صحار', address: 'صحار' },
  units: { id: 'unit-1', unit_number: 'A-1', floor: '2', status: 'occupied', rent_amount: 1000 },
  renewed_from: null,
} as ContractDetail;

describe('contract detail document actions', () => {
  beforeEach(() => {
    vi.mocked(documentService.printDocument).mockClear();
    vi.mocked(documentService.downloadDocumentPdf).mockClear();
  });

  it('prints the current contract through the canonical typed service without a UUID reference', async () => {
    printContractView(contract, settings);
    await vi.waitFor(() => expect(documentService.printDocument).toHaveBeenCalled());

    expect(documentService.printDocument).toHaveBeenCalledWith('contract', {
      settings,
      payload: expect.objectContaining({
        reference: null,
        status: 'active',
        tenantName: 'أحمد علي',
        propertyTitle: 'برج صحار',
        unitNumber: 'A-1',
        rentAmount: 1000,
      }),
    });
    expect(documentService.downloadDocumentPdf).not.toHaveBeenCalled();
  });

  it('downloads contract PDF through the canonical typed service', async () => {
    exportContractPdf(contract, settings);
    await vi.waitFor(() => expect(documentService.downloadDocumentPdf).toHaveBeenCalled());

    expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('contract', {
      settings,
      payload: expect.objectContaining({ tenantNationalId: 'ID-1', paymentCycle: 'monthly' }),
    });
  });
});
