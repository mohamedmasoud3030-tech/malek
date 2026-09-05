import { describe, expect, it } from 'vitest';
import type { CompanySettingsDraft } from '@/features/settings/settingsForm';
import { deriveOfficeReadiness } from './office-readiness';

const readyDraft: CompanySettingsDraft = {
  company_name: 'مكتب مالك العقاري', legal_name: '', tax_number: '', registration_number: '',
  phone: '+96890000000', email: '', address: 'الخوير', city: 'مسقط', country: 'OM',
  currency: 'OMR', locale: 'ar-OM', timezone: 'Asia/Muscat', date_format: 'dd/MM/yyyy', number_format: 'ar-OM', logo_url: '',
  invoice_prefix: 'INV', contract_prefix: 'CON', receipt_prefix: 'REC', default_vat_rate: '5', vat_enabled: 'true', vat_rate: '5', vat_registration_number: '',
  notification_email_enabled: 'true', notification_sms_enabled: 'false',
};

describe('deriveOfficeReadiness', () => {
  it('marks an operational office ready when the minimum launch contract is complete', () => {
    const readiness = deriveOfficeReadiness(readyDraft);
    expect(readiness.ready).toBe(true);
    expect(readiness.completed).toBe(4);
    expect(readiness.percent).toBe(100);
    expect(readiness.nextAction).toBeNull();
  });

  it('requires identity, one contact channel, localization, and document prefixes', () => {
    const readiness = deriveOfficeReadiness({
      ...readyDraft,
      company_name: '', city: '', phone: '', email: '', currency: '', invoice_prefix: '',
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.completed).toBe(0);
    expect(readiness.nextAction).toBe('هوية المكتب');
    expect(readiness.items.map((item) => item.ready)).toEqual([false, false, false, false]);
  });
});
