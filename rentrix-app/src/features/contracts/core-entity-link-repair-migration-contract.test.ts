import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const coreSql = readFileSync(
  new URL('../../../../supabase/migrations/20260718143000_repair_core_entity_contract_links.sql', import.meta.url),
  'utf8',
);
const backfillSql = readFileSync(
  new URL('../../../../supabase/migrations/20260718143100_backfill_owner_agreements.sql', import.meta.url),
  'utf8',
);
const reportsSql = readFileSync(
  new URL('../../../../supabase/migrations/20260718143200_align_owner_tenant_report_sources.sql', import.meta.url),
  'utf8',
);
const balancesSql = readFileSync(
  new URL('../../../../supabase/migrations/20260718143300_align_owner_balance_source.sql', import.meta.url),
  'utf8',
);

describe('core entity link repair migrations', () => {
  it('keeps owner and property compatibility names synchronized at the database boundary', () => {
    expect(coreSql).toContain('trg_sync_owner_compatibility_fields');
    expect(coreSql).toContain('trg_sync_property_compatibility_fields');
    expect(coreSql).toContain('INSERT INTO public.properties (name, title');
  });

  it('creates ownership before the agreement and enforces temporal ownership coverage', () => {
    const ownershipInsert = coreSql.indexOf('INSERT INTO public.property_owners');
    const agreementInsert = coreSql.indexOf('INSERT INTO public.owner_agreements');

    expect(ownershipInsert).toBeGreaterThan(0);
    expect(agreementInsert).toBeGreaterThan(ownershipInsert);
    expect(coreSql).toContain('trg_owner_agreement_requires_ownership');
    expect(coreSql).toContain('مالك الاتفاقية لا يملك العقار طوال فترة الاتفاقية');
  });

  it('backfills only uncovered properties and fails closed if any managed property remains uncovered', () => {
    expect(backfillSql).toContain("'property_management'");
    expect(backfillSql).toContain('NOT EXISTS (');
    expect(backfillSql).toContain('Owner agreement backfill incomplete');
  });

  it('uses canonical people and payment sources in tenant and owner reports', () => {
    expect(reportsSql).toContain("JOIN public.people t ON t.id = c.tenant_id AND t.type = 'tenant'");
    expect(reportsSql).toContain('FROM public.payments p');
    expect(reportsSql).toContain("upper(COALESCE(p.status, '')) <> 'VOID'");
    expect(reportsSql).not.toContain('JOIN public.tenants');
    expect(reportsSql).not.toContain('FROM public.receipts r');
  });

  it('does not reinterpret fixed monthly fees as a percentage', () => {
    expect(reportsSql).toContain("CASE WHEN oc.commission_type = 'RATE'");
    expect(balancesSql).toContain("CASE WHEN oa.commission_type = 'RATE'");
    expect(balancesSql).not.toContain('coalesce(o.commission_value / 100');
  });
});
