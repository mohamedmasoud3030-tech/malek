import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('authoritative property-ownership model contract', () => {
  const migrationSource = readFileSync(
    resolve(import.meta.dirname, '../../../../supabase/migrations/20260801000001_authoritative_property_ownership_view.sql'),
    'utf8',
  ).toLowerCase();

  const temporalControlsMigration = readFileSync(
    resolve(import.meta.dirname, '../../../../supabase/migrations/20260713000100_owner_agreement_temporal_controls.sql'),
    'utf8',
  ).toLowerCase();

  const p1SettlementDerivation = readFileSync(
    resolve(import.meta.dirname, '../../../../supabase/migrations/20260725000000_p1_owner_settlement_server_derivation.sql'),
    'utf8',
  ).toLowerCase();

  it('defines the canonical public.current_property_ownership view joining property_owners and owner_agreements', () => {
    expect(migrationSource).toContain('create or replace view public.current_property_ownership');
    expect(migrationSource).toContain('join public.property_owners po on po.property_id = pr.id');
    expect(migrationSource).toContain('join public.owners o on o.id = po.owner_id');
    expect(migrationSource).toContain('left join public.owner_agreements oa');
    expect(migrationSource).toContain('grant select on public.current_property_ownership to authenticated, service_role');
  });

  it('enforces temporal integrity and prevents overlapping ownership exceeding 100%', () => {
    expect(temporalControlsMigration).toContain('assert_property_owner_temporal_integrity');
    expect(temporalControlsMigration).toContain('where new.ownership_percentage + coalesce(');
    expect(temporalControlsMigration).toContain('> 100');
    expect(temporalControlsMigration).toContain('لا يمكن وجود أكثر من مالك أساسي لنفس العقار في فترة زمنية متداخلة');
  });

  it('authoritatively calculates owner settlements using property_owners and owner_agreements', () => {
    expect(p1SettlementDerivation).toContain('create or replace function public.calculate_owner_net_payout');
    expect(p1SettlementDerivation).toContain('from public.owner_agreements');
    expect(p1SettlementDerivation).toContain('from public.property_owners po');
    expect(p1SettlementDerivation).toContain('and upper(coalesce(e.charged_to, \'\')) = \'owner\'');
  });

  it('prevents properties.owner_id from acting as an independent source of truth by maintaining it via trigger projection', () => {
    const repairMigration = readFileSync(
      resolve(import.meta.dirname, '../../../../supabase/migrations/20260718113322_repair_core_entity_contract_links.sql'),
      'utf8',
    ).toLowerCase();

    expect(repairMigration).toContain('create trigger trg_sync_property_owner_projection');
    expect(repairMigration).toContain('after insert or update or delete on public.property_owners');
    expect(repairMigration).toContain('maintains properties.owner_id/owner_name as compatibility projections');
  });
});
