import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportContractPdf, printContractView } from './contractDetailActions';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { ContractDetail } from '../services/contractService';

vi.mock('@/services/documents/DocumentTemplates', () => ({
  DocumentTemplates: {
    printContractDocument: vi.fn(async () => undefined),
    downloadContractPdf: vi.fn(async () => undefined),
  },
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/services/action-service', () => ({ openWhatsApp: vi.fn(), shareOrCopy: vi.fn(async () => 'copied') }));

const { DocumentTemplates } = await import('@/services/documents/DocumentTemplates');

const settings = {
  companyName: 'Rentrix LLC',
  defaultCurrency: 'OMR',
} as CompanySettingsContract;

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
    vi.mocked(DocumentTemplates.printContractDocument).mockClear();
    vi.mocked(DocumentTemplates.downloadContractPdf).mockClear();
  });

  it('prints the current contract through the document engine', async () => {
    printContractView(contract, settings);
    await vi.waitFor(() => expect(DocumentTemplates.printContractDocument).toHaveBeenCalled());

    expect(DocumentTemplates.printContractDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 'contract-12345678',
        contractNumber: 'contract',
        contractStatus: 'active',
        tenantName: 'أحمد علي',
        propertyName: 'برج صحار',
        unitNumber: 'A-1',
        rentAmount: 1000,
      }),
      expect.objectContaining({ company: { name: 'Rentrix LLC' }, currency: 'OMR' }),
    );
    expect(DocumentTemplates.downloadContractPdf).not.toHaveBeenCalled();
  });

  it('downloads contract PDF through the document engine', async () => {
    exportContractPdf(contract, settings);
    await vi.waitFor(() => expect(DocumentTemplates.downloadContractPdf).toHaveBeenCalled());

    expect(DocumentTemplates.downloadContractPdf).toHaveBeenCalledWith(
      expect.objectContaining({ tenantNationalId: 'ID-1', paymentCycle: 'monthly' }),
      expect.objectContaining({ currency: 'OMR' }),
    );
  });
});
