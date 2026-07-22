import { describe, expect, it } from 'vitest';
import { buildContractsCsv, buildContractsCsvFilename, escapeContractCsvCell, getContractNumber } from './contractListExport';
import type { ContractListItem } from './services/contractService';

const baseContract: ContractListItem = {
  id: 'contract-123456789',
  property_id: 'property-1',
  unit_id: 'unit-1',
  tenant_id: 'tenant-1',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  rent_amount: 1250.5,
  payment_cycle: 'monthly',
  payment_terms_id: null,
  status: 'active',
  notes: null,
  renewed_from_id: null,
  cancellation_reason: null,
  attachment_url: null,
  agreement_id: null,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  properties: { id: 'property-1', title: 'برج الريان', address: 'مسقط، الخوير' },
  units: { id: 'unit-1', unit_number: 'A-101', floor: '1', status: 'occupied', rent_amount: 1250.5 },
  people: { id: 'tenant-1', full_name: 'أحمد بن سالم', phone: '+96890000000', email: 'tenant@example.com', national_id: 'OM123' },
};

describe('contract list CSV export helpers', () => {
  it('builds Arabic-first CSV with currency and lifecycle labels', () => {
    const csv = buildContractsCsv([baseContract]);

    expect(csv).toContain('رقم العقد,المستأجر,هاتف المستأجر,الوحدة,العقار,عنوان العقار,الإيجار,العملة,دورة السداد,تاريخ البداية,تاريخ النهاية,الحالة');
    expect(csv).toContain('#contract');
    expect(csv).toContain('أحمد بن سالم');
    expect(csv).toContain('OMR');
    expect(csv).toContain('شهري');
    expect(csv).toContain('نشط');
  });

  it('escapes CSV cells that include commas, quotes, or line breaks', () => {
    expect(escapeContractCsvCell('مسقط، الخوير')).toBe('مسقط، الخوير');
    expect(escapeContractCsvCell('A, B')).toBe('"A, B"');
    expect(escapeContractCsvCell('A "quoted" value')).toBe('"A ""quoted"" value"');
    expect(escapeContractCsvCell('Line\nbreak')).toBe('"Line\nbreak"');
  });

  it('renders legacy uppercase statuses with the same Arabic labels instead of blanks', () => {
    // The contracts CHECK constraint allows legacy 'ACTIVE'/'ENDED' spellings.
    const legacyRows: ContractListItem[] = [
      { ...baseContract, id: 'contract-legacy-active', status: 'ACTIVE' as ContractListItem['status'] },
      { ...baseContract, id: 'contract-legacy-ended', status: 'ENDED' as ContractListItem['status'] },
    ];
    const csv = buildContractsCsv(legacyRows);

    const [, activeRow, endedRow] = csv.split('\n');
    expect(activeRow).toContain('نشط');
    expect(activeRow).not.toContain('undefined');
    expect(endedRow).toContain('منتهي');
    expect(endedRow).not.toContain('undefined');
  });

  it('keeps contract export filenames deterministic from the provided date', () => {
    expect(getContractNumber(baseContract)).toBe('#contract');
    expect(buildContractsCsvFilename(new Date('2026-05-17T12:00:00Z'))).toBe('rentrix-contracts-2026-05-17.csv');
  });
});
