import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260716000001_owner_settlement_lifecycle_foundation.sql',
  ),
  'utf8',
);

describe('owner settlement lifecycle migration contract', () => {
  it('adds the collected-basis settlement breakdown required by the accounting decision', () => {
    expect(migrationSql).toContain('gross_collected numeric not null default 0');
    expect(migrationSql).toContain('office_fee numeric not null default 0');
    expect(migrationSql).toContain('owner_expenses numeric not null default 0');
    expect(migrationSql).toContain('tax_amount numeric not null default 0');
    expect(migrationSql).toContain('net_payable numeric not null default 0');
  });

  it('models draft, approval, payment, and cancellation as explicit states', () => {
    expect(migrationSql).toContain("alter column status set default 'DRAFT'");
    expect(migrationSql).toContain("array['DRAFT', 'APPROVED', 'PAID', 'CANCELLED']");
    expect(migrationSql).toContain('owner_settlements_approval_state_check');
    expect(migrationSql).toContain('owner_settlements_payment_state_check');
    expect(migrationSql).toContain('owner_settlements_cancellation_state_check');
  });

  it('requires approval evidence before paid state and payment evidence for paid rows', () => {
    expect(migrationSql).toContain("status in ('APPROVED', 'PAID')");
    expect(migrationSql).toContain('approved_at is not null');
    expect(migrationSql).toContain('approved_by is not null');
    expect(migrationSql).toContain("status <> 'PAID'");
    expect(migrationSql).toContain('paid_at is not null');
    expect(migrationSql).toContain('paid_by is not null');
  });

  it('protects idempotency and settlement-period lookup paths', () => {
    expect(migrationSql).toContain('owner_settlements_request_id_uidx');
    expect(migrationSql).toContain('where request_id is not null');
    expect(migrationSql).toContain('owner_settlements_owner_period_idx');
    expect(migrationSql).toContain("where status <> 'CANCELLED'");
  });

  it('does not generate settlements or change production execution state', () => {
    expect(migrationSql).not.toContain('insert into public.owner_settlements');
    expect(migrationSql).not.toContain('create or replace function');
    expect(migrationSql).not.toContain('supabase_migrations.schema_migrations');
  });
});
