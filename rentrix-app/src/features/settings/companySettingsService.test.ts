import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_BRAND_NAME } from '@/lib/brand';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

type QueryResult = { data: unknown; error: unknown };

function mockReadCompanySettings(result: QueryResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ limit }));
  supabaseMock.from.mockReturnValueOnce({ select });
  return { select, limit, maybeSingle };
}

function mockUpdateCompanySettings(result: QueryResult) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  supabaseMock.from.mockReturnValueOnce({ update });
  return { update, eq, select, single };
}

describe('companySettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes blank required fields to defaults and trims strings', async () => {
    const { normalizeCompanySettingsRecord } = await import('./companySettingsService');

    expect(normalizeCompanySettingsRecord({
      company_name: '  Rentrix Oman  ',
      legal_name: '  Rentrix LLC  ',
      currency: '   ',
      locale: '',
      country: ' Oman ',
      timezone: undefined,
      date_format: ' yyyy-MM-dd ',
      number_format: undefined,
      invoice_prefix: ' INV-OM ',
      receipt_prefix: '',
      logo_url: 'javascript:alert(1)',
    })).toMatchObject({
      company_name: 'Rentrix Oman',
      legal_name: 'Rentrix LLC',
      currency: 'OMR',
      locale: 'ar-OM',
      country: 'OM',
      timezone: 'Asia/Muscat',
      date_format: 'yyyy-MM-dd',
      number_format: 'ar-OM',
      invoice_prefix: 'INV-OM',
      receipt_prefix: 'REC',
      logo_url: null,
    });
  });

  it('does not stringify objects for nullable or required settings fields', async () => {
    const { normalizeCompanySettingsRecord, normalizeCompanySettingsUpdatePayload } = await import('./companySettingsService');
    const objectValue = { toString: () => 'should-not-stringify' };

    expect(normalizeCompanySettingsRecord({
      company_name: objectValue,
      legal_name: objectValue,
    } as Parameters<typeof normalizeCompanySettingsRecord>[0])).toMatchObject({
      company_name: APP_BRAND_NAME,
      legal_name: null,
    });
    expect(normalizeCompanySettingsUpdatePayload({
      company_name: objectValue,
      legal_name: objectValue,
    } as Parameters<typeof normalizeCompanySettingsUpdatePayload>[0])).toEqual({
      company_name: APP_BRAND_NAME,
      legal_name: null,
    });
  });

  it('still intentionally normalizes primitive numbers and booleans', async () => {
    const { normalizeCompanySettingsUpdatePayload } = await import('./companySettingsService');

    expect(normalizeCompanySettingsUpdatePayload({
      company_name: 123,
      legal_name: true,
    } as unknown as Parameters<typeof normalizeCompanySettingsUpdatePayload>[0])).toEqual({
      company_name: '123',
      legal_name: 'true',
    });
  });

  it('returns safe default settings when no row exists', async () => {
    mockReadCompanySettings({ data: null, error: null });

    const { DEFAULT_COMPANY_SETTINGS_ID, getCompanySettings } = await import('./companySettingsService');

    await expect(getCompanySettings()).resolves.toMatchObject({
      id: DEFAULT_COMPANY_SETTINGS_ID,
      company_name: APP_BRAND_NAME,
      currency: 'OMR',
      locale: 'ar-OM',
      country: 'OM',
      timezone: 'Asia/Muscat',
    });
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });

  it('excludes immutable fields from update payloads', async () => {
    const { normalizeCompanySettingsUpdatePayload } = await import('./companySettingsService');

    expect(normalizeCompanySettingsUpdatePayload({
      company_name: ' New Name ',
      country: 'unsupported',
      currency: '',
      locale: 'fr-FR',
      timezone: 'Europe/Paris',
      id: 'should-not-update',
      created_at: 'should-not-update',
      updated_at: 'should-not-update',
      singleton_key: false,
    } as Parameters<typeof normalizeCompanySettingsUpdatePayload>[0])).toEqual({
      company_name: 'New Name',
      country: 'OM',
      currency: 'OMR',
      locale: 'ar-OM',
      timezone: 'Asia/Muscat',
    });
  });

  it('updates only allowed normalized fields on the current settings row', async () => {
    mockReadCompanySettings({ data: { id: 'settings_1', company_name: 'Rentrix' }, error: null });
    const updateChain = mockUpdateCompanySettings({ data: { id: 'settings_1', company_name: 'Updated', currency: 'OMR' }, error: null });

    const { updateCompanySettings } = await import('./companySettingsService');

    await expect(updateCompanySettings({
      company_name: ' Updated ',
      currency: '',
      id: 'not-allowed',
    } as Parameters<typeof updateCompanySettings>[0])).resolves.toMatchObject({ company_name: 'Updated', currency: 'OMR' });
    expect(updateChain.update).toHaveBeenCalledWith({ company_name: 'Updated', currency: 'OMR' });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'settings_1');
  });
});
