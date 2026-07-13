import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  '../supabase/migrations/20260713000200_owner_statement_agreement_accounting.sql',
  'utf8',
);

describe('owner statement agreement accounting migration', () => {
  it('uses posted payments as the authoritative collection source', () => {
    expect(migrationSql).toContain('FROM public.payments p');
    expect(migrationSql).toContain("upper(COALESCE(p.status, 'POSTED')) = 'POSTED'");
    expect(migrationSql).toContain('p.deleted_at IS NULL');
    expect(migrationSql).not.toContain('FROM public.receipts');
  });

  it('resolves commission from the contract owner agreement covering the payment date', () => {
    expect(migrationSql).toContain('JOIN public.owner_agreements oa ON oa.id = c.agreement_id');
    expect(migrationSql).toContain('oa.owner_id = p_owner_id');
    expect(migrationSql).toContain('oa.starts_on <= pc.tx_day');
    expect(migrationSql).toContain('oa.ends_on IS NULL OR oa.ends_on >= pc.tx_day');
  });

  it('supports rate and fixed monthly agreement commissions without owner-level defaults', () => {
    expect(migrationSql).toContain("op.commission_type = 'RATE'");
    expect(migrationSql).toContain("op.commission_type = 'FIXED_MONTHLY'");
    expect(migrationSql).toContain("'commission_type', 'AGREEMENT_BASED'");
    expect(migrationSql).not.toContain('v_owner.commission_value');
  });

  it('matches owner-charged expenses through temporal agreements', () => {
    expect(migrationSql).toContain('EXISTS (');
    expect(migrationSql).toContain('oa.property_id = pr.id');
    expect(migrationSql).toContain('oa.starts_on <= public._safe_date(e.date_time)');
  });
});
