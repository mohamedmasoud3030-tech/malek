import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../p1/replay-bootstrap';

const ROLLBACK_SQL = readFileSync(fileURLToPath(new URL(
  '../../../supabase/rollback/20260813210000_rollback_wp02_fixed_monthly_daily_accrual.sql',
  import.meta.url,
)), 'utf8');

const COMPANY = 'c4070000-0000-4000-8000-000000000001';
const OTHER_COMPANY = 'c4070000-0000-4000-8000-000000000002';
const ACCOUNTANT = 'a4070000-0000-4000-8000-000000000001';
const OUTSIDER = 'a4070000-0000-4000-8000-000000000002';
const OWNER = '04070000-0000-4000-8000-000000000001';
const PROPERTY = '04070000-0000-4000-8000-000000000002';
const OTHER_OWNER = '04070000-0000-4000-8000-000000000003';
const OTHER_PROPERTY = '04070000-0000-4000-8000-000000000004';
const RATE_PROPERTY = '04070000-0000-4000-8000-000000000005';

const JAN_VERSION = '14070000-0000-4000-8000-000000000001';
const FEB_VERSION = '14070000-0000-4000-8000-000000000002';
const MID_VERSION = '14070000-0000-4000-8000-000000000003';
const DAILY_VERSION = '14070000-0000-4000-8000-000000000004';
const APR_VERSION = '14070000-0000-4000-8000-000000000005';
const JUN_VERSION = '14070000-0000-4000-8000-000000000006';
const AUG_VERSION = '14070000-0000-4000-8000-000000000007';
const RATE_VERSION = '14070000-0000-4000-8000-000000000008';
const OTHER_VERSION = '14070000-0000-4000-8000-000000000009';
const OVERLAP_VERSION = '14070000-0000-4000-8000-000000000010';
const OVERLAP_VERSION_2 = '14070000-0000-4000-8000-000000000011';
const TAXED_FIXED_VERSION = '14070000-0000-4000-8000-000000000012';

let db: PGlite;

async function publicRpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ value: string }>(
    `select public.${name}($1::jsonb)::text as value`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

async function internalRun(versionId: string, from: string, to = from) {
  const { rows } = await db.query<{ value: string }>(
    `select public.gl_run_fixed_monthly_accruals($1::uuid, $2::date, $3::date, $4::uuid, null)::text as value`,
    [COMPANY, from, to, versionId],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

async function scalarNumber(sql: string, params: unknown[] = []) {
  const { rows } = await db.query<{ value: string }>(sql, params);
  return Number(rows[0]?.value ?? 0);
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug, timezone) values
      ('${COMPANY}', 'GAP-007 Company', 'gap-007-company', 'Asia/Muscat'),
      ('${OTHER_COMPANY}', 'GAP-007 Other', 'gap-007-other', 'Asia/Muscat');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${ACCOUNTANT}', 'accountant@gap007.test', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OUTSIDER}', 'outsider@gap007.test', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ACCOUNTANT}', 'accountant@gap007.test', 'GAP Accountant', 'ACCOUNTANT', 'ACTIVE', true),
      ('${OUTSIDER}', 'outsider@gap007.test', 'Other Admin', 'ADMIN', 'ACTIVE', true);

    -- ACCOUNTANT is an application role; membership uses the separate
    -- OWNER/ADMIN/MEMBER/VIEWER company-membership vocabulary.
    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${ACCOUNTANT}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OUTSIDER}', 'ADMIN');

    insert into public.owners (id, full_name, name, company_id) values
      ('${OWNER}', 'GAP Owner', 'GAP Owner', '${COMPANY}'),
      ('${OTHER_OWNER}', 'Other Owner', 'Other Owner', '${OTHER_COMPANY}');

    insert into public.properties (id, title, name, type, address, company_id) values
      ('${PROPERTY}', 'GAP Property', 'GAP Property', 'residential', 'Muscat', '${COMPANY}'),
      ('${RATE_PROPERTY}', 'GAP Rate Property', 'GAP Rate Property', 'residential', 'Muscat', '${COMPANY}'),
      ('${OTHER_PROPERTY}', 'Other Property', 'Other Property', 'residential', 'Muscat', '${OTHER_COMPANY}');

    insert into public.property_owners
      (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id) values
      ('${PROPERTY}', '${OWNER}', 100, true, date '2023-01-01', '${COMPANY}'),
      ('${RATE_PROPERTY}', '${OWNER}', 100, true, date '2023-01-01', '${COMPANY}'),
      ('${OTHER_PROPERTY}', '${OTHER_OWNER}', 100, true, date '2023-01-01', '${OTHER_COMPANY}');

    insert into public.accounting_periods (company_id, name, start_date, end_date, status, closed_at) values
      ('${COMPANY}', '2024 Q1', date '2024-01-01', date '2024-03-31', 'OPEN', null),
      ('${COMPANY}', '2024 Apr soft', date '2024-04-01', date '2024-04-30', 'SOFT_CLOSED', now()),
      ('${COMPANY}', '2024 May open', date '2024-05-01', date '2024-05-31', 'OPEN', null),
      ('${COMPANY}', '2024 Jun hard', date '2024-06-01', date '2024-06-30', 'HARD_CLOSED', now()),
      ('${COMPANY}', '2024 Jul open', date '2024-07-01', date '2024-07-31', 'OPEN', null),
      ('${COMPANY}', '2024 Aug hard no successor', date '2024-08-01', date '2024-08-31', 'HARD_CLOSED', now());
  `);

  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [OTHER_COMPANY]);

  // Explicit versioned fee-tax configuration preserves the historical 0-tax
  // numerical matrix without silently treating an absent policy as zero.
  await db.exec(`
    insert into public.company_fee_tax_treatments
      (id, company_id, fee_kind, version_no, tax_code, tax_rate, effective_from,
       status, created_by, approved_by, approved_at)
    values
      ('a4070000-0000-4000-8000-000000000101', '${COMPANY}', 'FIXED_MONTHLY', 1, 'NON_TAXABLE', 0, date '2020-01-01',
       'ACTIVE', '${ACCOUNTANT}', '${OUTSIDER}', now());
  `);

  const agreementRows = [
    ['24070000-0000-4000-8000-000000000001', JAN_VERSION, 'FIXED_MONTHLY', 100, '2024-01-01', '2024-01-31', COMPANY, OWNER, PROPERTY],
    ['24070000-0000-4000-8000-000000000002', FEB_VERSION, 'FIXED_MONTHLY', 100, '2024-02-01', '2024-02-29', COMPANY, OWNER, PROPERTY],
    ['24070000-0000-4000-8000-000000000003', MID_VERSION, 'FIXED_MONTHLY', 31, '2024-03-10', '2024-03-20', COMPANY, OWNER, PROPERTY],
    ['24070000-0000-4000-8000-000000000004', DAILY_VERSION, 'FIXED_MONTHLY', 31, '2024-03-01', '2024-03-09', COMPANY, OWNER, PROPERTY],
    ['24070000-0000-4000-8000-000000000005', APR_VERSION, 'FIXED_MONTHLY', 30, '2024-04-01', '2024-04-01', COMPANY, OWNER, PROPERTY],
    ['24070000-0000-4000-8000-000000000006', JUN_VERSION, 'FIXED_MONTHLY', 30, '2024-06-01', '2024-06-01', COMPANY, OWNER, PROPERTY],
    ['24070000-0000-4000-8000-000000000007', AUG_VERSION, 'FIXED_MONTHLY', 31, '2024-08-01', '2024-08-01', COMPANY, OWNER, PROPERTY],
    ['24070000-0000-4000-8000-000000000008', RATE_VERSION, 'RATE', 10, '2024-03-01', '2024-03-31', COMPANY, OWNER, RATE_PROPERTY],
    ['24070000-0000-4000-8000-000000000009', OTHER_VERSION, 'FIXED_MONTHLY', 31, '2024-03-01', '2024-03-01', OTHER_COMPANY, OTHER_OWNER, OTHER_PROPERTY],
    ['24070000-0000-4000-8000-000000000012', TAXED_FIXED_VERSION, 'FIXED_MONTHLY', 31, '2024-05-01', '2024-05-01', COMPANY, OWNER, PROPERTY],
  ] as const;

  for (const [agreementId, versionId, commissionType, amount, startsOn, endsOn, companyId, ownerId, propertyId] of agreementRows) {
    await db.query(
      `insert into public.owner_agreements
         (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id)
       values ($1::uuid, $2::uuid, $3::uuid, 'property_management', $4, $5::numeric, $6::date, $7::date, $8::uuid)`,
      [agreementId, ownerId, propertyId, commissionType, amount, startsOn, endsOn, companyId],
    );
    await db.query(
      `insert into public.owner_agreement_versions
         (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
          commission_type, commission_value, commission_recognition_basis, effective_from, effective_to)
       values ($1::uuid, $2::uuid, $3::uuid, 1, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR',
          $4, $5::numeric, $6, $7::date, $8::date)`,
      [
        versionId,
        agreementId,
        companyId,
        commissionType,
        amount,
        commissionType === 'RATE' ? 'ON_COLLECTION' : 'DAILY_ACCRUAL',
        startsOn,
        endsOn,
      ],
    );
    await db.query(
      'update public.owner_agreements set current_version_id = $1::uuid where id = $2::uuid',
      [versionId, agreementId],
    );
  }

  await assumeIdentity(db, ACCOUNTANT, COMPANY);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('WP-02 GAP-007 FIXED_MONTHLY daily accrual lifecycle', () => {
  it('fails closed before posting when the independently versioned FIXED_MONTHLY fee-tax treatment is absent', async () => {
    await expect(db.query(
      `select public.gl_run_fixed_monthly_accruals($1::uuid, date '2024-03-01', date '2024-03-01', $2::uuid, null)`,
      [OTHER_COMPANY, OTHER_VERSION],
    )).rejects.toThrow(/FEE_TAX_TREATMENT_MISSING/);
  });

  it('allocates full 31-day and leap-February months exactly at OMR 3dp', async () => {
    const jan = await publicRpc('execute_fixed_monthly_accruals_atomic', {
      request_id: 'gap007-jan-full',
      date_from: '2024-01-01',
      date_to: '2024-01-31',
      agreement_version_id: JAN_VERSION,
    });
    expect(jan.created_days).toBe(31);
    expect(jan.net_amount).toBe(100);
    expect(jan.tax_amount).toBe(0);
    expect(jan.gross_amount).toBe(100);

    const feb = await internalRun(FEB_VERSION, '2024-02-01', '2024-02-29');
    expect(feb.created_days).toBe(29);
    expect(feb.net_amount).toBe(100);

    const janDistribution = await db.query<{ day: number; amount: string }>(
      `select calendar_day as day, net_amount::text as amount
         from public.fixed_monthly_daily_accruals
        where agreement_version_id = $1::uuid order by accrual_date`,
      [JAN_VERSION],
    );
    expect(janDistribution.rows.slice(0, 25).every((row) => row.amount === '3.226')).toBe(true);
    expect(janDistribution.rows.slice(25).every((row) => row.amount === '3.225')).toBe(true);

    expect(await scalarNumber(
      `select count(*)::text as value from public.journal_lines l
        join public.journal_batches b on b.id = l.batch_id
        join public.accounts a on a.id = l.account_id
       where b.company_id = $1::uuid and a.no = '2100'
         and b.source_type = 'pm_fixed_monthly_daily_accrual'`,
      [COMPANY],
    )).toBe(0);
  });

  it('uses a separately versioned FIXED_MONTHLY fee treatment and posts explicit 2100 tax when configured', async () => {
    await db.exec(`
      insert into public.company_fee_tax_treatments
        (id, company_id, fee_kind, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
      values ('a4070000-0000-4000-8000-000000000102', '${COMPANY}', 'FIXED_MONTHLY', 2, 'VAT', 5, date '2024-05-01',
        'ACTIVE', '${OUTSIDER}', '${ACCOUNTANT}', now());
    `);
    const taxed = await internalRun(TAXED_FIXED_VERSION, '2024-05-01');
    expect(taxed.net_amount).toBe(1);
    expect(taxed.tax_amount).toBe(0.05);
    expect(taxed.gross_amount).toBe(1.05);
    const { rows } = await db.query<{ tax_authority_status: string; fee_tax_code: string; fee_tax_rate: string }>(
      `select tax_authority_status, fee_tax_code, fee_tax_rate::text
         from public.fixed_monthly_daily_accruals where agreement_version_id = $1::uuid`,
      [TAXED_FIXED_VERSION],
    );
    expect(rows[0]).toMatchObject({ tax_authority_status: 'VERSIONED_FEE_TREATMENT', fee_tax_code: 'VAT', fee_tax_rate: '5.000' });
    expect(await scalarNumber(
      `select coalesce(sum(credit),0)::text as value from public.journal_lines jl
        join public.accounts a on a.id=jl.account_id where a.company_id=$1::uuid and a.no='2100'`,
      [COMPANY],
    )).toBeGreaterThanOrEqual(0.05);
  });

  it('uses only eligible calendar shares for a mid-month start and end', async () => {
    const result = await internalRun(MID_VERSION, '2024-03-01', '2024-03-31');
    expect(result.attempted_days).toBe(11);
    expect(result.created_days).toBe(11);
    expect(result.net_amount).toBe(11);

    const { rows } = await db.query<{ first_date: string; last_date: string }>(
      `select min(accrual_date)::text as first_date, max(accrual_date)::text as last_date
         from public.fixed_monthly_daily_accruals where agreement_version_id = $1::uuid`,
      [MID_VERSION],
    );
    expect(rows[0]).toEqual({ first_date: '2024-03-10', last_date: '2024-03-20' });
  });

  it('produces the same final state for daily execution, catch-up and overlapping replay', async () => {
    for (let day = 1; day <= 9; day += 1) {
      await internalRun(DAILY_VERSION, `2024-03-${String(day).padStart(2, '0')}`);
    }

    const catchUp = await internalRun(DAILY_VERSION, '2024-03-01', '2024-03-09');
    expect(catchUp.created_days).toBe(0);
    expect(catchUp.idempotent_days).toBe(9);
    expect(catchUp.net_amount).toBe(9);

    expect(await scalarNumber(
      `select count(*)::text as value from public.fixed_monthly_daily_accruals
        where agreement_version_id = $1::uuid`,
      [DAILY_VERSION],
    )).toBe(9);
    expect(await scalarNumber(
      `select sum(net_amount)::text as value from public.fixed_monthly_daily_accruals
        where agreement_version_id = $1::uuid`,
      [DAILY_VERSION],
    )).toBe(9);

    const cached = await publicRpc('execute_fixed_monthly_accruals_atomic', {
      request_id: 'gap007-jan-full',
      date_from: '2024-01-01',
      date_to: '2024-01-31',
      agreement_version_id: JAN_VERSION,
    });
    expect(cached.created_days).toBe(31);
    expect(await scalarNumber(
      `select count(*)::text as value from public.fixed_monthly_daily_accruals
        where agreement_version_id = $1::uuid`,
      [JAN_VERSION],
    )).toBe(31);

    await expect(publicRpc('execute_fixed_monthly_accruals_atomic', {
      request_id: 'gap007-jan-full',
      date_from: '2024-01-01',
      date_to: '2024-01-30',
      agreement_version_id: JAN_VERSION,
    })).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/);
  });

  it('uses canonical OPEN, SOFT_CLOSED and HARD_CLOSED period resolution without partial source rows', async () => {
    const soft = await internalRun(APR_VERSION, '2024-04-01');
    expect(soft.created_days).toBe(1);
    const hard = await internalRun(JUN_VERSION, '2024-06-01');
    expect(hard.created_days).toBe(1);

    const { rows } = await db.query<{ accrual_date: string; posting_date: string; late_posting: boolean }>(
      `select a.accrual_date::text, b.posting_date::text, b.late_posting
         from public.fixed_monthly_daily_accruals a
         join public.journal_batches b on b.id = a.journal_batch_id
        where a.agreement_version_id in ($1::uuid, $2::uuid)
        order by a.accrual_date`,
      [APR_VERSION, JUN_VERSION],
    );
    expect(rows).toEqual([
      { accrual_date: '2024-04-01', posting_date: '2024-05-01', late_posting: true },
      { accrual_date: '2024-06-01', posting_date: '2024-07-01', late_posting: true },
    ]);

    await expect(internalRun(AUG_VERSION, '2024-08-01')).rejects.toThrow(/NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD/);
    expect(await scalarNumber(
      `select count(*)::text as value from public.fixed_monthly_daily_accruals
        where agreement_version_id = $1::uuid`,
      [AUG_VERSION],
    )).toBe(0);
  });

  it('fails closed for cross-company, missing and non-FIXED terms', async () => {
    await expect(publicRpc('execute_fixed_monthly_accruals_atomic', {
      request_id: 'gap007-cross-company',
      date_from: '2024-03-01',
      date_to: '2024-03-01',
      agreement_version_id: OTHER_VERSION,
    })).rejects.toThrow(/FIXED_MONTHLY_VERSION_NOT_FOUND_OR_FORBIDDEN/);

    await expect(internalRun('14070000-0000-4000-8000-00000000ffff', '2024-03-01'))
      .rejects.toThrow(/FIXED_MONTHLY_VERSION_NOT_FOUND_OR_FORBIDDEN/);
    await expect(internalRun(RATE_VERSION, '2024-03-01'))
      .rejects.toThrow(/FIXED_MONTHLY_TERMS_INVALID/);

    await db.exec(`
      insert into public.owner_agreements
        (id, owner_id, property_id, agreement_type, commission_type,
         commission_value, starts_on, ends_on, company_id)
      values
        ('24070000-0000-4000-8000-000000000010', '${OWNER}', '${RATE_PROPERTY}',
         'property_management', 'FIXED_MONTHLY', 30, date '2024-09-01',
         date '2024-09-30', '${COMPANY}');

      insert into public.owner_agreement_versions
        (id, owner_agreement_id, company_id, version_no, operating_model,
         collection_role, commission_type, commission_value,
         commission_recognition_basis, effective_from, effective_to, superseded_at)
      values
        ('${OVERLAP_VERSION}', '24070000-0000-4000-8000-000000000010', '${COMPANY}',
         1, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR', 'FIXED_MONTHLY', 30,
         'DAILY_ACCRUAL', date '2024-09-01', date '2024-09-20', now()),
        ('${OVERLAP_VERSION_2}', '24070000-0000-4000-8000-000000000010', '${COMPANY}',
         2, 'OWNER_AGENCY', 'OWNER_IS_CREDITOR', 'FIXED_MONTHLY', 30,
         'DAILY_ACCRUAL', date '2024-09-10', date '2024-09-30', null);

      update public.owner_agreements
         set current_version_id = '${OVERLAP_VERSION_2}'
       where id = '24070000-0000-4000-8000-000000000010';
    `);
    await expect(internalRun(OVERLAP_VERSION, '2024-09-01', '2024-09-20'))
      .rejects.toThrow(/FIXED_MONTHLY_VERSION_INTERVAL_OVERLAP/);

    await expect(publicRpc('execute_fixed_monthly_accruals_atomic', {
      request_id: 'gap007-client-tax',
      date_from: '2024-03-01',
      date_to: '2024-03-01',
      agreement_version_id: DAILY_VERSION,
      tax_amount: 1.5,
    })).rejects.toThrow(/FIXED_MONTHLY_CLIENT_FINANCIAL_INPUT_FORBIDDEN/);
  });

  it('reverses idempotently with balanced 1300/4100 and no invented 2100 effect', async () => {
    const { rows: accrualRows } = await db.query<{ id: string; journal_batch_id: string }>(
      `select id::text, journal_batch_id::text
         from public.fixed_monthly_daily_accruals
        where agreement_version_id = $1::uuid and accrual_date = date '2024-01-01'`,
      [JAN_VERSION],
    );
    const accrual = accrualRows[0];
    expect(accrual).toBeTruthy();

    const reversed = await publicRpc('reverse_fixed_monthly_accrual_atomic', {
      request_id: 'gap007-reverse-jan-1',
      accrual_id: accrual.id,
      reason: 'Focused reversal balance evidence',
    });
    expect(reversed.status).toBe('REVERSED');

    const secondKey = await publicRpc('reverse_fixed_monthly_accrual_atomic', {
      request_id: 'gap007-reverse-jan-1-again',
      accrual_id: accrual.id,
      reason: 'Already reversed idempotent retry',
    });
    expect(secondKey.idempotent).toBe(true);
    expect(await scalarNumber(
      'select count(*)::text as value from public.fixed_monthly_daily_accrual_reversals where accrual_id = $1::uuid',
      [accrual.id],
    )).toBe(1);

    const { rows: balances } = await db.query<{ no: string; balance: string }>(
      `select a.no, coalesce(sum(l.debit - l.credit), 0)::text as balance
         from public.accounts a
         left join public.journal_lines l on l.account_id = a.id
          and l.batch_id in ($2::uuid, $3::uuid)
        where a.company_id = $1::uuid and a.no in ('1300','4100','2100')
        group by a.no order by a.no`,
      [COMPANY, accrual.journal_batch_id, reversed.reversal_batch_id],
    );
    expect(balances).toEqual([
      { no: '1300', balance: '0.000' },
      { no: '2100', balance: '0' },
      { no: '4100', balance: '0.000' },
    ]);

    const unbalanced = await scalarNumber(
      `select count(*)::text as value from (
         select l.batch_id from public.journal_lines l
          where l.batch_id in ($1::uuid, $2::uuid)
          group by l.batch_id having sum(l.debit) <> sum(l.credit)
       ) x`,
      [accrual.journal_batch_id, reversed.reversal_batch_id],
    );
    expect(unbalanced).toBe(0);

    await expect(db.query(
      'update public.fixed_monthly_daily_accruals set net_amount = 0 where id = $1::uuid',
      [accrual.id],
    )).rejects.toThrow(/FIXED_MONTHLY_ACCRUAL_IMMUTABLE/);
  });

  it('lists source, posting and reversal state through the governed read RPC', async () => {
    const result = await publicRpc('list_fixed_monthly_accruals', {
      date_from: '2024-01-01',
      date_to: '2024-01-31',
    });
    expect(result.total_count).toBe(31);
    expect(result.net_amount).toBe(100);
    expect(result.tax_amount).toBe(0);
    expect(result.reversed_count).toBe(1);
    const rows = result.accruals as Array<Record<string, unknown>>;
    expect(rows.some((row) => row.status === 'REVERSED')).toBe(true);
    expect(rows.every((row) => row.tax_authority_status === 'VERSIONED_FEE_TREATMENT')).toBe(true);
  });

  it('rolls back cleanly only while the GAP-007 ledgers are empty', async () => {
    const emptyReplay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(emptyReplay.failed).toEqual([]);
    try {
      await emptyReplay.db.exec(ROLLBACK_SQL);
      const { rows } = await emptyReplay.db.query<{ accrual_table: string | null; reversal_table: string | null }>(
        `select
           to_regclass('public.fixed_monthly_daily_accruals')::text as accrual_table,
           to_regclass('public.fixed_monthly_daily_accrual_reversals')::text as reversal_table`,
      );
      expect(rows[0]).toEqual({ accrual_table: null, reversal_table: null });
    } finally {
      await emptyReplay.db.close();
    }
  }, 30_000);

  it('blocks rollback once immutable GAP-007 financial history exists', async () => {
    await expect(db.exec(ROLLBACK_SQL)).rejects.toThrow(/ROLLBACK_BLOCKED_FINANCIAL_HISTORY/);
  });
});