import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';

const COMPANY_A = 'c3000000-0000-4000-8000-000000000001';
const COMPANY_B = 'c3000000-0000-4000-8000-000000000002';
const ADMIN_A = 'a3000000-0000-4000-8000-000000000001';
const ADMIN_B = 'a3000000-0000-4000-8000-000000000002';
const OWNER_A = 'b3000000-0000-4000-8000-000000000001';
const OWNER_B = 'b3000000-0000-4000-8000-000000000002';
const PROPERTY_A = 'd3000000-0000-4000-8000-000000000001';
const PROPERTY_B = 'd3000000-0000-4000-8000-000000000002';
const UNIT_A = 'e3000000-0000-4000-8000-000000000001';
const UNIT_B = 'e3000000-0000-4000-8000-000000000002';
const TENANT_A = 'f3000000-0000-4000-8000-000000000001';
const TENANT_B = 'f3000000-0000-4000-8000-000000000002';
const AGREEMENT_A = 'aa300000-0000-4000-8000-000000000001';
const AGREEMENT_B = 'aa300000-0000-4000-8000-000000000002';
const CONTRACT_A = 'cc300000-0000-4000-8000-000000000001';
const CONTRACT_B = 'cc300000-0000-4000-8000-000000000002';
const MIGRATION = '20260727092000_phase3a1a_execution_hardening.sql';
const ROLLBACK = '20260727_rollback_phase3a1a_execution_hardening.sql';

let db: PGlite;
const evidence: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  migration: MIGRATION,
};

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query(`select public.${name}($1::jsonb) as result`, [JSON.stringify(payload)]);
  return (rows[0] as { result: Record<string, unknown> }).result;
}

async function seedFixture() {
  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY_A}', 'Phase3A Company A', 'phase3a-a'),
      ('${COMPANY_B}', 'Phase3A Company B', 'phase3a-b');

    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'admin-a@phase3a.test'),
      ('${ADMIN_B}', 'admin-b@phase3a.test');

    insert into public.users (id, email, name, role, status) values
      ('${ADMIN_A}', 'admin-a@phase3a.test', 'Admin A', 'ADMIN', 'ACTIVE'),
      ('${ADMIN_B}', 'admin-b@phase3a.test', 'Admin B', 'ADMIN', 'ACTIVE');

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
      ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN');

    insert into public.owners (id, full_name, name, company_id) values
      ('${OWNER_A}', 'Owner A', 'Owner A', '${COMPANY_A}'),
      ('${OWNER_B}', 'Owner B', 'Owner B', '${COMPANY_B}');

    insert into public.properties (id, title, name, type, address, company_id) values
      ('${PROPERTY_A}', 'Property A', 'Property A', 'residential', 'Muscat', '${COMPANY_A}'),
      ('${PROPERTY_B}', 'Property B', 'Property B', 'residential', 'Muscat', '${COMPANY_B}');

    insert into public.property_owners
      (property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on, company_id) values
      ('${PROPERTY_A}', '${OWNER_A}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_A}'),
      ('${PROPERTY_B}', '${OWNER_B}', 100, true, date '2026-01-01', date '2027-12-31', '${COMPANY_B}');

    insert into public.owner_agreements
      (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id) values
      ('${AGREEMENT_A}', '${OWNER_A}', '${PROPERTY_A}', 'property_management', 'RATE', 10, date '2026-01-01', date '2027-12-31', '${COMPANY_A}'),
      ('${AGREEMENT_B}', '${OWNER_B}', '${PROPERTY_B}', 'property_management', 'RATE', 10, date '2026-01-01', date '2027-12-31', '${COMPANY_B}');

    insert into public.units (id, property_id, name, unit_number, company_id) values
      ('${UNIT_A}', '${PROPERTY_A}', 'Unit A', 'A-1', '${COMPANY_A}'),
      ('${UNIT_B}', '${PROPERTY_B}', 'Unit B', 'B-1', '${COMPANY_B}');

    insert into public.people (id, full_name, type, company_id) values
      ('${TENANT_A}', 'Tenant A', 'tenant', '${COMPANY_A}'),
      ('${TENANT_B}', 'Tenant B', 'tenant', '${COMPANY_B}');

    insert into public.contracts
      (id, property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, agreement_id, company_id) values
      ('${CONTRACT_A}', '${PROPERTY_A}', '${UNIT_A}', '${TENANT_A}', date '2026-01-01', date '2026-12-31', 12000, 'active', '${AGREEMENT_A}', '${COMPANY_A}'),
      ('${CONTRACT_B}', '${PROPERTY_B}', '${UNIT_B}', '${TENANT_B}', date '2026-01-01', date '2026-12-31', 12000, 'active', '${AGREEMENT_B}', '${COMPANY_B}');

    update public.accounts
       set company_id = '${COMPANY_A}'
     where no in ('1111', '2200', '6100');
  `);
}

async function journalBalance(sourceId: string) {
  const { rows } = await db.query(
    `select
       coalesce(sum(case when type = 'DEBIT' then amount else 0 end), 0)::numeric as debit,
       coalesce(sum(case when type = 'CREDIT' then amount else 0 end), 0)::numeric as credit,
       bool_and(company_id = $2::uuid) as company_ok
     from public.journal_entries
     where source_id::text = $1`,
    [sourceId, COMPANY_A],
  );
  const row = rows[0] as { debit: string | number; credit: string | number; company_ok: boolean };
  return { debit: Number(row.debit), credit: Number(row.credit), companyOk: row.company_ok };
}

function writeEvidence(name: string, value: unknown) {
  const dir = join(repoRoot, 'evidence', 'p3', 'phase3a1');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
}

describe('Phase 3A-1A execution hardening', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    expect(replay.applied.some((file) => file.includes(MIGRATION))).toBe(true);
    db = replay.db;
    await seedFixture();
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  it('keeps account helpers internal and fail-closed', async () => {
    const { rows } = await db.query(`
      select
        has_function_privilege('authenticated', 'public.require_company_account_id(uuid,text)', 'EXECUTE') as require_auth,
        has_function_privilege('authenticated', 'public.ensure_company_account(uuid,text,text)', 'EXECUTE') as ensure_auth,
        has_function_privilege('service_role', 'public.ensure_company_account(uuid,text,text)', 'EXECUTE') as ensure_service
    `);
    const row = rows[0] as { require_auth: boolean; ensure_auth: boolean; ensure_service: boolean };
    expect(row.require_auth).toBe(false);
    expect(row.ensure_auth).toBe(false);
    expect(row.ensure_service).toBe(true);
    evidence.helperAcl = row;
  });

  it('executes expense create/update/retry with balanced company journals', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const created = await rpc('create_expense_with_journal_atomic', {
      request_id: 'phase3a-expense-shared',
      property_id: PROPERTY_A,
      category: 'maintenance',
      amount: 12.345,
      expense_date: '2026-07-24',
      description: 'Phase 3A execution test',
    });
    const retried = await rpc('create_expense_with_journal_atomic', {
      request_id: 'phase3a-expense-shared',
      property_id: PROPERTY_A,
      category: 'maintenance',
      amount: 12.345,
      expense_date: '2026-07-24',
    });
    expect(retried.idempotent).toBe(true);
    expect(retried.expense_id).toBe(created.expense_id);

    const updated = await rpc('update_expense_with_journal_atomic', {
      request_id: 'phase3a-expense-update',
      expense_id: created.expense_id,
      amount: 15.125,
      expense_date: '2026-07-25',
    });
    expect(updated.success).toBe(true);
    const balance = await journalBalance(String(created.expense_id));
    expect(balance.debit).toBeCloseTo(balance.credit, 3);
    expect(balance.companyOk).toBe(true);

    const { rows } = await db.query(
      `select count(*)::int as count from public.expenses where id::text = $1 and company_id = $2::uuid`,
      [created.expense_id, COMPANY_A],
    );
    expect((rows[0] as { count: number }).count).toBe(1);
    evidence.expense = { created, retried, updated, balance };
  });

  it('does not leak a company A idempotency response into company B', async () => {
    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    await expect(
      rpc('create_expense_with_journal_atomic', {
        request_id: 'phase3a-expense-shared',
        property_id: PROPERTY_B,
        category: 'maintenance',
        amount: 9.5,
        expense_date: '2026-07-24',
      }),
    ).rejects.toThrow(/ACCOUNT_NUMBER_GLOBAL_UNIQUENESS_BLOCKED/);
    evidence.crossCompanyIdempotency = { isolated: true, requestId: 'phase3a-expense-shared' };
  });

  it('executes canonical deposit receive/deduct/refund and rejects property mismatch', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const created = await rpc('create_deposit_atomic', {
      request_id: 'phase3a-deposit-create',
      contract_id: CONTRACT_A,
      tenant_id: TENANT_A,
      property_id: PROPERTY_A,
      unit_id: UNIT_A,
      amount: 100,
      received_date: '2026-07-24',
    });
    const retried = await rpc('create_deposit_atomic', {
      request_id: 'phase3a-deposit-create',
      contract_id: CONTRACT_A,
      amount: 100,
      received_date: '2026-07-24',
    });
    expect(retried.idempotent).toBe(true);
    expect(retried.deposit_id).toBe(created.deposit_id);

    await expect(
      rpc('deduct_deposit_atomic', {
        request_id: 'phase3a-deposit-mismatch',
        deposit_id: created.deposit_id,
        property_id: PROPERTY_B,
        amount: 10,
        charged_date: '2026-07-25',
      }),
    ).rejects.toThrow(/canonical deposit property/);

    const deducted = await rpc('deduct_deposit_atomic', {
      request_id: 'phase3a-deposit-deduct',
      deposit_id: created.deposit_id,
      property_id: PROPERTY_A,
      amount: 25,
      charged_date: '2026-07-25',
      reason: 'damage',
    });
    const refunded = await rpc('refund_deposit_atomic', {
      request_id: 'phase3a-deposit-refund',
      deposit_id: created.deposit_id,
      amount: 30,
      refund_date: '2026-07-26',
    });
    expect(Number(deducted.remaining)).toBeCloseTo(75, 3);
    expect(Number(refunded.remaining)).toBeCloseTo(45, 3);

    await expect(
      rpc('refund_deposit_atomic', {
        request_id: 'phase3a-deposit-over-refund',
        deposit_id: created.deposit_id,
        amount: 46,
        refund_date: '2026-07-26',
      }),
    ).rejects.toThrow(/Insufficient remaining balance/);

    const balance = await journalBalance(String(created.deposit_id));
    expect(balance.debit).toBeCloseTo(balance.credit, 3);
    expect(balance.companyOk).toBe(true);

    const { rows } = await db.query(
      `select remaining_amount::numeric as remaining, company_id, property_id::text as property_id
       from public.tenant_deposits where id::text = $1`,
      [created.deposit_id],
    );
    const deposit = rows[0] as { remaining: string | number; company_id: string; property_id: string };
    expect(Number(deposit.remaining)).toBeCloseTo(45, 3);
    expect(deposit.company_id).toBe(COMPANY_A);
    expect(deposit.property_id).toBe(PROPERTY_A);
    evidence.deposit = { created, retried, deducted, refunded, balance, deposit };
  });

  it('uses company-namespaced idempotency keys for all five Phase 3A-1A operations', async () => {
    const { rows } = await db.query(
      `select operation_name, request_id
       from public.financial_operation_idempotency
       where operation_name like '%:${COMPANY_A}'
       order by operation_name, request_id`,
    );
    const names = rows.map((row) => String((row as { operation_name: string }).operation_name));
    for (const operation of [
      'create_expense_with_journal_atomic',
      'update_expense_with_journal_atomic',
      'create_deposit_atomic',
      'deduct_deposit_atomic',
      'refund_deposit_atomic',
    ]) {
      expect(names.some((name) => name === `${operation}:${COMPANY_A}`)).toBe(true);
    }
    evidence.idempotency = rows;
  });

  it('preserves catalog security and supports forward/rollback/reapply', async () => {
    const { rows: beforeRows } = await db.query(`
      select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'create_expense_with_journal_atomic',
          'update_expense_with_journal_atomic',
          'deduct_deposit_atomic',
          'refund_deposit_atomic'
        )
      order by p.proname
    `);
    expect(beforeRows).toHaveLength(4);
    expect(beforeRows.every((row) => (row as { prosecdef: boolean }).prosecdef)).toBe(true);
    expect(beforeRows.every((row) => String((row as { config: string }).config).includes('search_path=public, pg_temp'))).toBe(true);

    const rollbackSql = readFileSync(join(repoRoot, 'supabase', 'rollback', ROLLBACK), 'utf8');
    await db.exec(rollbackSql);
    const { rows: rolledRows } = await db.query(`
      select count(*)::int as wrappers,
             count(*) filter (where proname like '%_phase3a1a_impl')::int as impls
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (p.proname in (
          'create_expense_with_journal_atomic',
          'update_expense_with_journal_atomic',
          'deduct_deposit_atomic',
          'refund_deposit_atomic'
        ) or p.proname like '%_phase3a1a_impl')
    `);
    expect((rolledRows[0] as { wrappers: number; impls: number }).wrappers).toBe(4);
    expect((rolledRows[0] as { wrappers: number; impls: number }).impls).toBe(0);

    const migrationSql = readFileSync(join(repoRoot, 'supabase', 'migrations', MIGRATION), 'utf8');
    await db.exec(migrationSql);
    const { rows: reappliedRows } = await db.query(`
      select count(*)::int as impls from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like '%_phase3a1a_impl'
    `);
    expect((reappliedRows[0] as { impls: number }).impls).toBe(4);
    evidence.catalog = beforeRows;
    evidence.rollbackReapply = { rollback: 'passed', reapply: 'passed' };

    writeEvidence('phase3a1a-expense-deposit-lifecycle.json', {
      generatedAt: evidence.generatedAt,
      expense: evidence.expense,
      deposit: evidence.deposit,
    });
    writeEvidence('phase3a1a-two-company-isolation.json', {
      generatedAt: evidence.generatedAt,
      crossCompanyIdempotency: evidence.crossCompanyIdempotency,
      helperAcl: evidence.helperAcl,
    });
    writeEvidence('phase3a1a-idempotency-isolation.json', {
      generatedAt: evidence.generatedAt,
      rows: evidence.idempotency,
    });
    writeEvidence('phase3a1a-catalog-contract.json', {
      generatedAt: evidence.generatedAt,
      functions: evidence.catalog,
    });
    writeEvidence('phase3a1a-forward-rollback-fingerprint.json', {
      generatedAt: evidence.generatedAt,
      result: evidence.rollbackReapply,
    });
  });
});
