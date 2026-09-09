import { readFileSync } from 'node:fs';
import { repoRoot } from '@/p1/replay-bootstrap';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  COMPANY,
  CONTRACT,
  OTHER,
  OTHER_COMPANY,
  MAKER,
  PROPERTY,
  OWNER,
  createOfficeCreditorFixture,
} from '@/test/office-creditor-fixture';
import {
  offsetFixtureCommand as command,
  offsetDate as at,
} from '@/test/owner-offset-fixture';
import { assumeIdentity } from '@/p1/replay-bootstrap';
let db: PGlite;
let expense: string;
let period: string;
const checker = 'c2000000-0000-4000-8000-000000000097';
beforeAll(async () => {
  ({ db } = await createOfficeCreditorFixture());
  await db.query('insert into auth.users(id,email) values($1::uuid,$2)', [
    checker,
    'source-checker@test.local',
  ]);
  await db.query(
    "insert into public.users(id,email,name,role,status,is_active) values($1::uuid,$2,'Source checker','ACCOUNTANT','ACTIVE',true)",
    [checker, 'source-checker@test.local'],
  );
  await db.query(
    "insert into public.company_members(company_id,user_id,role) values($1::uuid,$2::uuid,'ACCOUNTANT')",
    [COMPANY, checker],
  );
  await db.exec('set role authenticated');
  expense = String(
    (
      await command(db, 'create_expense_with_journal_atomic', {
        property_id: PROPERTY,
        category: 'صيانة',
        charged_to: 'OWNER',
        amount: 30.125,
        expense_date: at(9),
        request_id: 'source-expense',
      })
    ).expense_id,
  );
  period = (
    await db.query<{ id: string }>(
      'select id from public.accounting_periods where company_id=$1::uuid and $2::date between start_date and end_date',
      [COMPANY, at(9)],
    )
  ).rows[0].id;
}, 60_000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec('begin');
});
afterEach(async () => {
  await db.exec('rollback');
  await assumeIdentity(db, MAKER, COMPANY);
});
async function review(scoped = true, approved = true) {
  const row = await command(db, 's08_create_frozen_review', {
    accounting_period_id: period,
    review_scope: scoped ? { expense_ids: [expense] } : {},
    dataset_lineage: 'expense-control',
  });
  await db.query(
    "select public.s08_analyze_frozen_review($1::uuid,'{}','{}','[]')",
    [row.id],
  );
  if (approved) await approve(String(row.id));
  return String(row.id);
}
async function approve(id: string) {
  await assumeIdentity(db, checker, COMPANY);
  await db.exec('savepoint approval_attempt');
  try {
    await db.query('select public.s08_approve_frozen_review($1::uuid,$2)', [
      id,
      'Disposable independent source review',
    ]);
  } catch (error) {
    await db.exec('rollback to savepoint approval_attempt');
    throw error;
  } finally {
    await db.exec('release savepoint approval_attempt');
    await assumeIdentity(db, MAKER, COMPANY);
  }
}
async function draft(reviewId: string) {
  return String(
    (
      await command(db, 's09_create_correction_draft', {
        accounting_period_id: period,
        review_id: reviewId,
        source_type: 'expense',
        source_id: expense,
        source_scope: { dataset_lineage: 'expense-control' },
        reason: 'Approved source classification',
        amount: 30.125,
        debit_account_no: '1300',
        credit_account_no: '6100',
        request_id: crypto.randomUUID(),
      })
    ).id,
  );
}
async function mutateResponsibility() {
  await command(db, 'update_expense_with_journal_atomic', {
    expense_id: expense,
    charged_to: 'COMPANY',
    request_id: crypto.randomUUID(),
  });
}
async function balance(day: number) {
  return (
    await db.query(
      "select subledger_balance::text as source,gl_balance::text as control from public.wp05_reconcile_all($1::uuid,$2::date) where account_no='1300'",
      [COMPANY, at(day)],
    )
  ).rows;
}
it('dates approved expense compensation from the economic source, never the period opening', async () => {
  const id = await draft(await review());
  await db.query('select public.s09_validate_correction($1::uuid)', [id]);
  await db.query('select public.s09_apply_correction($1::uuid)', [id]);
  expect(await balance(8)).toEqual([{ source: '0.000', control: '0.000' }]);
  expect(await balance(9)).toEqual([{ source: '30.125', control: '30.125' }]);
});
it('rejects responsibility drift before approval even when count and amount are unchanged', async () => {
  const id = await review(true, false);
  await mutateResponsibility();
  await expect(approve(id)).rejects.toThrow(/EXPENSE_REVIEW_SOURCE_CHANGED/);
});
it('rejects ownership allocation drift before approval', async () => {
  const id = await review(true, false);
  await db.exec('reset role');
  await db.query(
    'update public.property_owners set ends_on=$1::date where company_id=$2::uuid and owner_id=$3::uuid and property_id=$4::uuid',
    [at(8), COMPANY, OWNER, PROPERTY],
  );
  await db.exec('set role authenticated');
  await expect(approve(id)).rejects.toThrow(/EXPENSE_REVIEW_SOURCE_CHANGED/);
});
it('rejects changed contract scope before drafting against an older approved review', async () => {
  const id = await review();
  await command(db, 'update_expense_with_journal_atomic', {
    expense_id: expense,
    contract_id: CONTRACT,
    request_id: crypto.randomUUID(),
  });
  await expect(draft(id)).rejects.toThrow(/EXPENSE_REVIEW_SOURCE_CHANGED/);
});
it('rechecks source evidence at apply, not merely at draft validation', async () => {
  const id = await draft(await review());
  await db.query('select public.s09_validate_correction($1::uuid)', [id]);
  await mutateResponsibility();
  const original = (
    await db.query('select * from public.journal_batches order by id')
  ).rows;
  await db.exec('savepoint failed_apply');
  await expect(
    db.query('select public.s09_apply_correction($1::uuid)', [id]),
  ).rejects.toThrow(/EXPENSE_REVIEW_SOURCE_CHANGED/);
  await db.exec(
    'rollback to savepoint failed_apply; release savepoint failed_apply',
  );
  expect(
    (await db.query('select * from public.journal_batches order by id')).rows,
  ).toEqual(original);
  expect(
    (
      await db.query(
        'select status from public.s09_corrections where id=$1::uuid',
        [id],
      )
    ).rows,
  ).toEqual([{ status: 'VALIDATED' }]);
});
it('requires a frozen explicitly named expense instead of borrowing an unrelated review', async () => {
  const id = await review(false);
  await expect(draft(id)).rejects.toThrow(/EXPENSE_REVIEW_SOURCE_REQUIRED/);
});
it('allows harmless description updates without changing approved financial source evidence', async () => {
  await command(db, 'update_expense_with_journal_atomic', {
    expense_id: expense,
    contract_id: CONTRACT,
    request_id: crypto.randomUUID(),
  });
  const id = await review();
  await command(db, 'update_expense_with_journal_atomic', {
    expense_id: expense,
    description: 'Receipt description clarified',
    request_id: crypto.randomUUID(),
  });
  const correction = await draft(id);
  await db.query('select public.s09_validate_correction($1::uuid)', [
    correction,
  ]);
});

it('requires an independent reviewer for frozen expense evidence', async () => {
  const id = await review(true, false);
  await expect(
    db.query('select public.s08_approve_frozen_review($1::uuid,$2)', [
      id,
      'Maker cannot approve own expense review',
    ]),
  ).rejects.toThrow(/INDEPENDENT_REVIEWER_REQUIRED/);
});
it('does not trust caller-supplied snapshot JSON', async () => {
  const id = String(
    (
      await command(db, 's08_create_frozen_review', {
        accounting_period_id: period,
        review_scope: {
          expense_ids: [expense],
          _expense_sources: { [expense]: { amount: 0 } },
        },
      })
    ).id,
  );
  const row = (
    await db.query<{ version: number; amount: string }>(
      "select expense_source_snapshot_version as version,review_scope->'_expense_sources'->$2->'expense'->>'amount' as amount from public.s08_frozen_reviews where id=$1::uuid",
      [id, expense],
    )
  ).rows[0];
  expect(row).toEqual({ version: 1, amount: '30.125' });
});
it('keeps frozen scope immutable even under the lifecycle write marker', async () => {
  const id = await review(true, false);
  await db.exec('reset role');
  await db.query(
    "select set_config('malik.s08_review_change_authorized','true',true)",
  );
  await expect(
    db.query(
      "update public.s08_frozen_reviews set review_scope='{}' where id=$1::uuid",
      [id],
    ),
  ).rejects.toThrow(/IMMUTABLE_FIELD/);
});
it('detects a prior correction before another validated proposal can post against the same source', async () => {
  const r = await review();
  const a = await draft(r);
  const b = await draft(r);
  await db.query('select public.s09_validate_correction($1::uuid)', [a]);
  await db.query('select public.s09_validate_correction($1::uuid)', [b]);
  await db.query('select public.s09_apply_correction($1::uuid)', [a]);
  await expect(
    db.query('select public.s09_apply_correction($1::uuid)', [b]),
  ).rejects.toThrow(/EXPENSE_REVIEW_SOURCE_CHANGED/);
});
it('keeps the snapshot and comparison implementation private', async () => {
  const rows = (
    await db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated',name,'execute') as allowed from unnest(array['app_private.expense_correction_source_snapshot(uuid,text)','app_private.require_expense_review_source(uuid,uuid,text)']) name",
    )
  ).rows;
  expect(rows).toEqual([{ allowed: false }, { allowed: false }]);
});

it('preserves old posted corrections and refuses to trust pre-upgrade caller snapshot JSON', async () => {
  const { db: old } = await createOfficeCreditorFixture({
    throughMigration: '20260909000010',
  });
  try {
    await old.exec('set role authenticated');
    const payload = {
      property_id: PROPERTY,
      category: 'صيانة',
      charged_to: 'OWNER',
      amount: 10,
      expense_date: at(1),
      request_id: 'old-source-correction',
    };
    const e = String(
      (await command(old, 'create_expense_with_journal_atomic', payload))
        .expense_id,
    );
    const p = (
      await old.query<{ id: string }>(
        'select id from public.accounting_periods where company_id=$1::uuid and $2::date between start_date and end_date',
        [COMPANY, at(1)],
      )
    ).rows[0].id;
    const r = String(
      (
        await command(old, 's08_create_frozen_review', {
          accounting_period_id: p,
          review_scope: {
            expense_ids: [e],
            _expense_sources: { [e]: { version: 1 } },
          },
          dataset_lineage: 'legacy-review',
        })
      ).id,
    );
    await old.query(
      "select public.s08_analyze_frozen_review($1::uuid,'{}','{}','[]')",
      [r],
    );
    await old.query('select public.s08_approve_frozen_review($1::uuid,$2)', [
      r,
      'Pre-upgrade synthetic approval',
    ]);
    const proposal = {
      accounting_period_id: p,
      review_id: r,
      source_type: 'expense',
      source_id: e,
      source_scope: { dataset_lineage: 'legacy-review' },
      reason: 'Legacy approved classification',
      amount: 10,
      debit_account_no: '1300',
      credit_account_no: '6100',
      request_id: 'old-proposal',
    };
    const c = String(
      (await command(old, 's09_create_correction_draft', proposal)).id,
    );
    await old.query('select public.s09_validate_correction($1::uuid)', [c]);
    await old.query('select public.s09_apply_correction($1::uuid)', [c]);
    const batches = (
      await old.query('select * from public.journal_batches order by id')
    ).rows;
    const frozen = (
      await old.query(
        'select to_jsonb(r) as data from public.s08_frozen_reviews r where id=$1::uuid',
        [r],
      )
    ).rows;
    await old.exec('reset role');
    await old.exec(
      readFileSync(
        `${repoRoot}/supabase/migrations/20260909000011_expense_correction_review_source.sql`,
        'utf8',
      ),
    );
    await old.exec('set role authenticated');
    expect(
      (await old.query('select * from public.journal_batches order by id'))
        .rows,
    ).toEqual(batches);
    expect(
      (
        await old.query(
          "select to_jsonb(r)-'expense_source_snapshot_version' as data from public.s08_frozen_reviews r where id=$1::uuid",
          [r],
        )
      ).rows,
    ).toEqual(frozen);
    expect(
      (await command(old, 's09_create_correction_draft', proposal)).id,
    ).toBe(c);
    expect(
      (await command(old, 'create_expense_with_journal_atomic', payload))
        .expense_id,
    ).toBe(e);
    await expect(
      command(old, 's09_create_correction_draft', {
        ...proposal,
        request_id: 'cannot-trust-old-json',
      }),
    ).rejects.toThrow(/EXPENSE_REVIEW_SOURCE_REQUIRED/);
    await old.query('select public.s09_reverse_correction($1::uuid,$2)', [
      c,
      'Existing correction remains reversible',
    ]);
  } finally {
    await old.close();
  }
}, 60_000);

it.each(['OPERATIONS', 'USER'])(
  'does not expose frozen financial source data to %s without report authority',
  async (role) => {
    const id = await review(true, false);
    await db.exec('reset role');
    await db.query(
      'update public.company_members set role=$1 where company_id=$2::uuid and user_id=$3::uuid',
      [role, COMPANY, MAKER],
    );
    await db.exec('set role authenticated');
    expect(
      (
        await db.query(
          'select review_scope from public.s08_frozen_reviews where id=$1::uuid',
          [id],
        )
      ).rows,
    ).toEqual([]);
    await db.exec('reset role');
    await db.query(
      "insert into public.user_permission_grants(company_id,user_id,permission,granted_by) values($1::uuid,$2::uuid,'financial.reports.view',$3::uuid)",
      [COMPANY, MAKER, checker],
    );
    await db.exec('set role authenticated');
    expect(
      (
        await db.query(
          'select review_scope from public.s08_frozen_reviews where id=$1::uuid',
          [id],
        )
      ).rows,
    ).toHaveLength(1);
  },
);
it('isolates frozen financial snapshots and source scope across companies', async () => {
  const id = await review(true, false);
  await db.exec('reset role');
  const otherPeriod = (
    await db.query<{ id: string }>(
      "insert into public.accounting_periods(company_id,name,start_date,end_date,status) values($1::uuid,'Other scope',date_trunc('month',$2::date),(date_trunc('month',$2::date)+interval '1 month' - interval '1 day')::date,'OPEN') returning id",
      [OTHER_COMPANY, at(1)],
    )
  ).rows[0].id;
  await db.exec('set role authenticated');
  await assumeIdentity(db, OTHER, OTHER_COMPANY);
  expect(
    (
      await db.query(
        'select review_scope from public.s08_frozen_reviews where id=$1::uuid',
        [id],
      )
    ).rows,
  ).toEqual([]);
  await expect(
    command(db, 's08_create_frozen_review', {
      accounting_period_id: otherPeriod,
      review_scope: { expense_ids: [expense] },
    }),
  ).rejects.toThrow(/EXPENSE_REVIEW_SOURCE_NOT_FOUND_OR_FORBIDDEN/);
});
