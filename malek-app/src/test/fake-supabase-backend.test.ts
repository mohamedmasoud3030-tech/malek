import { describe, expect, it } from 'vitest';
import { buildAcceptanceSeed } from '../../e2e/support/fake-supabase-backend';

describe('document acceptance backend accounting dependencies', () => {
  it('seeds the authoritative cash-flow and six-account reconciliation contracts', () => {
    const seed = buildAcceptanceSeed('complete');

    expect(seed.rpcs.rpt_cash_flow_gl({ p_from: '2026-08-01', p_to: '2026-08-31' })).toMatchObject({
      period: { from: '2026-08-01', to: '2026-08-31' },
      variance: 0,
      is_balanced: true,
      currency: 'OMR',
    });
    const reconciliation = seed.rpcs.wp05_reconcile_all({});
    expect(reconciliation).toHaveLength(6);
    expect(reconciliation).toEqual(
      expect.arrayContaining([
        ['TENANT_RECEIVABLES', '1201'],
        ['DUE_FROM_OWNER', '1300'],
        ['OWNER_PAYABLES', '2000'],
        ['VAT_PAYABLE', '2100'],
        ['SECURITY_DEPOSITS', '2200'],
        ['COMMISSION', '2300'],
      ].map(([reconciliation_class, account_no]) =>
        expect.objectContaining({ reconciliation_class, account_no, reconciliation_status: 'PASS', variance: 0 }),
      )),
    );
  });

  it('seeds the authenticated shell ownership and completed onboarding contracts', () => {
    const seed = buildAcceptanceSeed('complete');

    expect(seed.tables.property_owners).toEqual([
      expect.objectContaining({
        property_id: '22222222-2222-4222-8222-222222222222',
        owner_id: '88888888-8888-4888-8888-888888888801',
        ownership_percentage: 100,
        is_primary: true,
      }),
    ]);
    expect(seed.rpcs.get_company_onboarding_state({})).toEqual({
      company_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      completed: true,
      requirements: [],
    });
  });
});