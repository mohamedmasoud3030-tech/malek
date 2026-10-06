// Create authentic legacy sources before adoption, then exercise the current
// migration12 authorities; these scenarios must not run only against old code.
import { readFileSync } from 'node:fs';
import { assumeIdentity, repoRoot } from '@/p1/replay-bootstrap';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  COMPANY,
  MAKER,
  OWNER,
  PROPERTY,
  OTHER_COMPANY,
  createOfficeCreditorFixture,
} from '@/test/office-creditor-fixture';
import {
  offsetFixtureCommand,
  offsetDate as at,
} from '@/test/owner-offset-fixture';
let db: PGlite;
let period: string;
let previousPeriod: string;
let expense: string;
async function read(company = COMPANY, scope = period) {
  return (
    await db.query<{
      expense_id: string;
      charged_to: string;
      amount: string;
      account_no: string;
      finding_code: string;
    }>(
      'select * from public.s08_analyze_expense_misclassification($1::uuid,$2::uuid)',
      [company, scope],
    )
  ).rows;
}
beforeAll(async () => {
  ({ db } = await createOfficeCreditorFixture({throughMigration:'20260909000011'}));
  previousPeriod = (
    await db.query<{ id: string }>(
      `insert into public.accounting_periods(company_id,name,start_date,end_date,status) values($1::uuid,'Prior diagnostic period',date_trunc('month',$2::date)-interval '1 month',date_trunc('month',$2::date)-interval '1 day','OPEN') returning id`,
      [COMPANY, at(1)],
    )
  ).rows[0].id;
  await db.exec('set role authenticated');
  expense = String(
    (
      await offsetFixtureCommand(db, 'create_expense_with_journal_atomic', {
        property_id: PROPERTY,
        category: 'صيانة',
        charged_to: 'OWNER',
        amount: 30.125,
        expense_date: at(1),
        request_id: 'expense-diagnostic',
      })
    ).expense_id,
  );
  period = (
    await db.query<{ id: string }>(
      'select id from public.accounting_periods where company_id=$1::uuid and $2::date between start_date and end_date limit 1',
      [COMPANY, at(1)],
    )
  ).rows[0].id;
  await db.exec('reset role');
  await db.exec(readFileSync(`${repoRoot}/supabase/migrations/20260909000012_owner_expense_allocation_source.sql`,'utf8'));
  await db.exec('set role authenticated');
}, 60_000);
afterAll(async () => {
  await db?.close();
});
it('finds the real owner expense using charged responsibility and exact OMR evidence', async () => {
  expect(await read()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        expense_id: expense,
        charged_to: 'OWNER',
        account_no: '6100',
        amount: '30.125',
        finding_code: 'OWNER_TENANT_EXPENSE_IN_OFFICE_ACCOUNT',
      }),
    ]),
  );
});
it('uses the requested company period, not a company-wide scan labeled with that period', async () => {
  expect((await read()).some(row=>row.expense_id===expense)).toBe(true);
  expect(await read(COMPANY,previousPeriod)).toEqual([]);
});
it('does not turn a valid company expense category into an owner allocation', async () => {
  await db.exec('begin');
  try {
    const id = String(
      (
        await offsetFixtureCommand(db, 'create_expense_with_journal_atomic', {
          property_id: PROPERTY,
          category: 'OWNER',
          charged_to: 'COMPANY',
          amount: 12.345,
          expense_date: at(1),
          request_id: 'diagnostic-company',
        })
      ).expense_id,
    );
    expect(
      (await read())
        .filter((row) => row.expense_id === id)
        .some(
          (row) =>
            row.finding_code === 'OWNER_TENANT_EXPENSE_IN_OFFICE_ACCOUNT',
        ),
    ).toBe(false);
  } finally {
    await db.exec('rollback');
  }
});
it('retains original posted source, retry identity and the actual unrepaired reconciliation failure', async () => {
  const before = (
    await db.query('select * from public.journal_batches order by id')
  ).rows;
  await read();
  await read();
  expect(
    (await db.query('select * from public.journal_batches order by id')).rows,
  ).toEqual(before);
  expect(
    (
      await offsetFixtureCommand(db, 'create_expense_with_journal_atomic', {
        property_id: PROPERTY,
        category: 'صيانة',
        charged_to: 'OWNER',
        amount: 30.125,
        expense_date: at(1),
        request_id: 'expense-diagnostic',
      })
    ).expense_id,
  ).toBe(expense);
  expect(
    (
      await db.query(
        "select subledger_balance::text as source,gl_balance::text as control,reconciliation_status from public.wp05_reconcile_all($1::uuid,$2::date) where account_no='1300'",
        [COMPANY, at(1)],
      )
    ).rows,
  ).toEqual([
    { source: '30.125', control: '0.000', reconciliation_status: 'FAIL' },
  ]);
});
it('rejects foreign company or foreign period rather than returning a misleading empty analysis', async () => {
  await expect(read(OTHER_COMPANY)).rejects.toThrow(/ISOLATION|FORBIDDEN/);
  await expect(read(COMPANY, crypto.randomUUID())).rejects.toThrow(/PERIOD/);
});
it.each(['ACCOUNTANT', 'VIEWER'])(
  'retains complete diagnostic evidence for the authorized %s',
  async (role) => {
    await db.exec('begin');
    try {
      await db.exec('reset role');
      await db.query(
        'update public.company_members set role=$1 where company_id=$2::uuid and user_id=$3::uuid',
        [role, COMPANY, MAKER],
      );
      await db.exec('set role authenticated');
      expect(
        (await read()).some(
          (row) => row.expense_id === expense && row.amount === '30.125',
        ),
      ).toBe(true);
    } finally {
      await db.exec('rollback');
    }
  },
);
it('rejects a disabled actor', async () => {
  await db.exec('begin');
  try {
    await db.exec('reset role');
    await db.query(
      'update public.users set is_active=false where id=$1::uuid',
      [MAKER],
    );
    await db.exec('set role authenticated');
    await expect(read()).rejects.toThrow(/PERMISSION_REQUIRED|AUTH_REQUIRED/);
  } finally {
    await db.exec('rollback');
  }
});
it('reports ambiguous multi-owner allocation once instead of assigning the entire expense to each owner', async () => {
  await db.exec('begin');
  try {
    await db.exec('reset role');
    const other = crypto.randomUUID();
    await db.query(
      'insert into public.owners(id,name,company_id) values($1::uuid,$2,$3::uuid)',
      [other, 'Allocation owner', COMPANY],
    );
    await db.query(
      'update public.property_owners set ownership_percentage=50 where property_id=$1::uuid and owner_id=$2::uuid',
      [PROPERTY, OWNER],
    );
    await db.query(
      'insert into public.property_owners(property_id,owner_id,ownership_percentage,is_primary,starts_on,company_id) values($1::uuid,$2::uuid,50,false,$3::date,$4::uuid)',
      [PROPERTY, other, at(1), COMPANY],
    );
    await db.exec('set role authenticated');
    expect(
      (await read()).filter(
        (row) =>
          row.expense_id === expense &&
          row.finding_code === 'OWNER_ALLOCATION_UNRESOLVED',
      ),
    ).toHaveLength(1);
  } finally {
    await db.exec('rollback');
  }
});

it('tracks an approved source-scoped compensation and its reversal without rewriting the original posting', async () => {
  await db.exec('begin');
  try {
    const original = (
      await db.query<{ id: string }>(
        'select id from public.journal_batches where company_id=$1::uuid and source_type=$2 and source_id=$3',
        [COMPANY, 'expense', expense],
      )
    ).rows[0].id;
    const originalEvidence = (
      await db.query(
        'select to_jsonb(b) as evidence from public.journal_batches b where id=$1::uuid',
        [original],
      )
    ).rows;
    const findings = await read();
    const review = await offsetFixtureCommand(db, 's08_create_frozen_review', {
      accounting_period_id: period,
      review_scope: { expense_ids: [expense] },
      dataset_lineage: 'expense-source-review',
      evidence_reference:
        'Disposable test evidence only; no production approval',
    });
    await db.query(
      'select public.s08_analyze_frozen_review($1::uuid,$2::jsonb,$3::jsonb,$4::jsonb)',
      [
        review.id,
        JSON.stringify(findings),
        JSON.stringify({ source: '30.125', control: '0.000' }),
        '[]',
      ],
    );
    const checker = crypto.randomUUID();
    await db.exec('reset role');
    await db.query('insert into auth.users(id,email) values($1::uuid,$2)', [
      checker,
      'expense-checker@test.local',
    ]);
    await db.query(
      "insert into public.users(id,email,name,role,status,is_active) values($1::uuid,$2,'Expense checker','ACCOUNTANT','ACTIVE',true)",
      [checker, 'expense-checker@test.local'],
    );
    await db.query(
      "insert into public.company_members(company_id,user_id,role) values($1::uuid,$2::uuid,'ACCOUNTANT')",
      [COMPANY, checker],
    );
    await db.exec('set role authenticated');
    await assumeIdentity(db, checker, COMPANY);
    await db.query('select public.s08_approve_frozen_review($1::uuid,$2)', [
      review.id,
      'Synthetic independent review of this expense only',
    ]);
    await assumeIdentity(db, MAKER, COMPANY);
    const correction = await offsetFixtureCommand(
      db,
      's09_create_correction_draft',
      {
        accounting_period_id: period,
        review_id: review.id,
        source_type: 'expense',
        source_id: expense,
        source_scope: { dataset_lineage: 'expense-source-review' },
        reason: 'Approved OWNER expense classification compensation',
        amount: 30.125,
        debit_account_no: '1300',
        credit_account_no: '6100',
        original_journal_batch_id: original,
        before_evidence: { findings },
        after_evidence: { expected_receivable: '30.125' },
        request_id: 'expense-source-compensation',
      },
    );
    await db.query('select public.s09_validate_correction($1::uuid)', [
      correction.id,
    ]);
    await db.query('select public.s09_apply_correction($1::uuid)', [
      correction.id,
    ]);
    expect(
      (await read()).some(
        (row) =>
          row.expense_id === expense &&
          row.finding_code === 'OWNER_TENANT_EXPENSE_IN_OFFICE_ACCOUNT',
      ),
    ).toBe(false);
    expect(
      (
        await db.query(
          "select subledger_balance::text as source,gl_balance::text as control,reconciliation_status from public.wp05_reconcile_all($1::uuid,$2::date) where account_no='1300'",
          [COMPANY, at(1)],
        )
      ).rows,
    ).toEqual([
      { source: '30.125', control: '30.125', reconciliation_status: 'PASS' },
    ]);
    expect(
      (
        await db.query(
          'select to_jsonb(b) as evidence from public.journal_batches b where id=$1::uuid',
          [original],
        )
      ).rows,
    ).toEqual(originalEvidence);
    await db.query('select public.s09_reverse_correction($1::uuid,$2)', [
      correction.id,
      'Synthetic compensation reversal',
    ]);
    expect(
      (await read()).some(
        (row) =>
          row.expense_id === expense &&
          row.finding_code === 'OWNER_TENANT_EXPENSE_IN_OFFICE_ACCOUNT',
      ),
    ).toBe(true);
    expect(
      (
        await db.query(
          'select to_jsonb(b) as evidence from public.journal_batches b where id=$1::uuid',
          [original],
        )
      ).rows,
    ).toEqual(originalEvidence);
  } finally {
    await db.exec('rollback');
    await assumeIdentity(db, MAKER, COMPANY);
  }
});

it('does not hide posted evidence when an imported source was later archived', async () => {
  await db.exec('begin');
  try {
    // Adversarial legacy source state only; no posted journal is modified.
    await db.exec('reset role');
    await db.query(
      'update public.expenses set deleted_at=now() where id=$1::uuid',
      [expense],
    );
    await db.exec('set role authenticated');
    const rows = await read();
    expect(
      rows.some(
        (row) =>
          row.expense_id === expense &&
          row.finding_code === 'EXPENSE_HISTORY_REQUIRES_REVIEW',
      ),
    ).toBe(true);
    expect(
      rows.some(
        (row) =>
          row.expense_id === expense &&
          row.finding_code === 'OWNER_TENANT_EXPENSE_IN_OFFICE_ACCOUNT',
      ),
    ).toBe(true);
  } finally {
    await db.exec('rollback');
  }
});
it('denies a role without report authority and retains the public ACL boundary', async () => {
  expect(
    (
      await db.query<{ allowed: boolean }>(
        "select has_function_privilege('anon','public.s08_analyze_expense_misclassification(uuid,uuid)','execute') as allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
  await db.exec('begin');
  try {
    await db.exec('reset role');
    await db.query(
      "update public.company_members set role='OPERATIONS' where company_id=$1::uuid and user_id=$2::uuid",
      [COMPANY, MAKER],
    );
    await db.exec('set role authenticated');
    await expect(read()).rejects.toThrow(/PERMISSION_REQUIRED/);
  } finally {
    await db.exec('rollback');
  }
});
