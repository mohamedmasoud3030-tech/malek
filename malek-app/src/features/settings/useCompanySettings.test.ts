import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQuery: vi.fn((options) => options),
  useQueryClient: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: queryMock.useMutation,
  useQuery: queryMock.useQuery,
  useQueryClient: queryMock.useQueryClient,
}));

vi.mock('./companySettingsService', () => ({
  getCompanySettings: vi.fn(),
  updateCompanySettings: vi.fn(),
}));

describe('useCompanySettings hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.useQueryClient.mockReturnValue({ invalidateQueries: queryMock.invalidateQueries });
    queryMock.invalidateQueries.mockResolvedValue(undefined);
  });

  it('adapts persisted company settings records to the normalized downstream contract', async () => {
    const { companySettingsRecordToContract } = await import('./useCompanySettings');

    expect(companySettingsRecordToContract({
      company_name: ' شركة الاختبار ',
      logo_url: ' https://example.test/logo.png ',
      locale: 'en-OM',
      currency: 'AED',
      country: 'AE',
      timezone: 'Asia/Dubai',
      receipt_prefix: ' RCT ',
      invoice_prefix: ' TAX ',
    } as never)).toMatchObject({
      companyName: 'شركة الاختبار',
      logoUrl: 'https://example.test/logo.png',
      defaultLanguage: 'en',
      defaultCurrency: 'AED',
      country: 'AE',
      timezone: 'Asia/Dubai',
      receiptPrefix: 'RCT',
      invoicePrefix: 'TAX',
      locale: 'en-OM',
      direction: 'ltr',
    });
  });

  it('invalidates company settings queries after updating settings', async () => {
    const { companySettingsKeys, useUpdateCompanySettings } = await import('./useCompanySettings');

    const mutationOptions = useUpdateCompanySettings() as unknown as { onSuccess: () => Promise<void> };
    await mutationOptions.onSuccess();

    expect(queryMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: companySettingsKeys.all });
    expect(queryMock.invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
