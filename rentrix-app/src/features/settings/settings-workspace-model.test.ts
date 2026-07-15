import { describe, expect, it } from 'vitest';
import { getCompanySettingsPreviewModel, type CompanySettingsDraft } from './settingsForm';
import { buildSettingsSummaryTiles } from './settings-workspace-model';

const validDraft: CompanySettingsDraft = {
  company_name: 'Rentrix',
  legal_name: '',
  tax_number: '',
  registration_number: '',
  phone: '',
  email: '',
  address: '',
  city: 'Muscat',
  country: 'OM',
  currency: 'OMR',
  locale: 'ar-OM',
  timezone: 'Asia/Muscat',
  date_format: 'dd/MM/yyyy',
  number_format: 'ar-OM',
  logo_url: '',
  invoice_prefix: 'INV',
  contract_prefix: 'CON',
  receipt_prefix: 'REC',
  default_vat_rate: '5',
  vat_enabled: 'true',
  vat_rate: '5',
  vat_registration_number: '',
  notification_email_enabled: 'true',
  notification_sms_enabled: 'false',
};

describe('buildSettingsSummaryTiles', () => {
  it('compresses setup, save, and session state into three decision tiles', () => {
    const tiles = buildSettingsSummaryTiles({
      draft: validDraft,
      preview: getCompanySettingsPreviewModel(validDraft),
      isDirty: false,
      hasAuthorization: true,
      metadataMismatch: false,
    });

    expect(tiles).toHaveLength(3);
    expect(tiles.map((tile) => tile.value)).toEqual(['مكتملة', 'محفوظة', 'صالحة']);
  });

  it('surfaces incomplete setup, unsaved changes, and metadata mismatch', () => {
    const draft = {
      ...validDraft,
      company_name: '',
      currency: '',
      invoice_prefix: '',
    };
    const tiles = buildSettingsSummaryTiles({
      draft,
      preview: getCompanySettingsPreviewModel(draft),
      isDirty: true,
      hasAuthorization: true,
      metadataMismatch: true,
    });

    expect(tiles.map((tile) => tile.value)).toEqual(['0/3', 'غير محفوظة', 'تحتاج مراجعة']);
    expect(tiles.map((tile) => tile.tone)).toEqual(['red', 'gold', 'gold']);
  });
});
