import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity } from '../src/p1/replay-bootstrap';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  COMPANY,
  MAKER,
  PROPERTY,
  createOfficeCreditorFixture,
} from '../src/test/office-creditor-fixture';
import {
  offsetFixtureCommand,
  offsetDate as at,
} from '../src/test/owner-offset-fixture';
import { repoRoot } from '../src/p1/replay-bootstrap';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';

async function installFinancialReads(page: Page, db: PGlite) {
  await page.route('**/rest/v1/rpc/wp05_reconcile_all', async (route) => {
    const { p_as_of } = route.request().postDataJSON();
    const result = await db.query(
      'select * from public.wp05_reconcile_all($1::uuid,$2::date)',
      [COMPANY, p_as_of],
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result.rows),
    });
  });
  await page.route('**/rest/v1/rpc/rpt_trial_balance', async (route) => {
    const { p_as_of } = route.request().postDataJSON();
    const result = await db.query<{ data: unknown }>(
      'select public.rpt_trial_balance($1::date) as data',
      [p_as_of],
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result.rows[0].data),
    });
  });
}

// Historical source is deliberately created under the pre-repair chain. The
// read-only diagnostic must expose it, not silently repair old money on upgrade.
test('historical OWNER expense remains visibly unreconciled and source-identifiable after diagnostic upgrade', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { db } = await createOfficeCreditorFixture({
    throughMigration: '20260909000009',
  });
  try {
    await db.exec('set role authenticated');
    const payload = {
      property_id: PROPERTY,
      category: 'صيانة',
      charged_to: 'OWNER',
      amount: 30.125,
      expense_date: at(1),
      request_id: 'browser-old-owner-expense',
    };
    const created = await offsetFixtureCommand(
      db,
      'create_expense_with_journal_atomic',
      payload,
    );
    const before = (
      await db.query('select * from public.journal_batches order by id')
    ).rows;
    await db.exec('reset role');
    await db.exec(
      readFileSync(
        `${repoRoot}/supabase/migrations/20260909000010_expense_history_diagnostic_lineage.sql`,
        'utf8',
      ),
    );
    await db.exec('set role authenticated');
    expect(
      (await db.query('select * from public.journal_batches order by id')).rows,
    ).toEqual(before);
    expect(
      (
        await offsetFixtureCommand(
          db,
          'create_expense_with_journal_atomic',
          payload,
        )
      ).expense_id,
    ).toBe(created.expense_id);
    const period = (
      await db.query<{ id: string }>(
        'select id from public.accounting_periods where company_id=$1::uuid and $2::date between start_date and end_date limit 1',
        [COMPANY, at(1)],
      )
    ).rows[0].id;
    const findings = (
      await db.query(
        'select expense_id,charged_to,amount::text,finding_code from public.s08_analyze_expense_misclassification($1::uuid,$2::uuid)',
        [COMPANY, period],
      )
    ).rows;
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expense_id: created.expense_id,
          charged_to: 'OWNER',
          amount: '30.125',
          finding_code: 'OWNER_TENANT_EXPENSE_IN_OFFICE_ACCOUNT',
        }),
      ]),
    );
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page);
    await installFinancialReads(page, db);
    await page.goto(
      `/reports/financial-settlement-pack?view=statements&asOf=${at(1)}`,
    );
    await expect(page.getByText(/1 من 6 تحتاج مراجعة/)).toBeVisible();
    // Failed reconciliation expands its evidence automatically; only PASS uses a disclosure.
    const cards = page.getByRole('list', {
      name: 'تفاصيل مراجعة الأرصدة المحاسبية',
    });
    const values = (await cards.isVisible())
      ? cards
          .getByRole('listitem')
          .filter({ hasText: '1300' })
          .locator('span[dir="ltr"].tabular-nums')
      : page
          .getByRole('table', { name: 'تفاصيل مراجعة الأرصدة المحاسبية' })
          .getByRole('row')
          .filter({ hasText: '1300' })
          .getByRole('cell');
    const start = (await cards.isVisible()) ? 0 : 1;
    await expect(values.nth(start)).toContainText('30.125');
    await expect(values.nth(start + 1)).toContainText('0.000');
  } finally {
    await db.close();
  }
});

// The existing correction RPC is exercised directly; this is report UI proof,
// not a claim that an expense correction command screen already exists.
test('approved mid-period expense correction preserves earlier and later report cutoffs', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { db } = await createOfficeCreditorFixture({
    throughMigration: '20260909000010',
  });
  try {
    await db.exec('set role authenticated');
    const expense = String(
      (
        await offsetFixtureCommand(db, 'create_expense_with_journal_atomic', {
          property_id: PROPERTY,
          category: 'صيانة',
          charged_to: 'OWNER',
          amount: 30.125,
          expense_date: at(9),
          request_id: 'browser-correction-source',
        })
      ).expense_id,
    );
    const period = (
      await db.query<{ id: string }>(
        'select id from public.accounting_periods where company_id=$1::uuid and $2::date between start_date and end_date',
        [COMPANY, at(9)],
      )
    ).rows[0].id;
    const checker = crypto.randomUUID();
    await db.exec('reset role');
    await db.query('insert into auth.users(id,email) values($1::uuid,$2)', [
      checker,
      'browser-reviewer@test.local',
    ]);
    await db.query(
      "insert into public.users(id,email,name,role,status,is_active) values($1::uuid,$2,'Browser reviewer','ACCOUNTANT','ACTIVE',true)",
      [checker, 'browser-reviewer@test.local'],
    );
    await db.query(
      "insert into public.company_members(company_id,user_id,role) values($1::uuid,$2::uuid,'ACCOUNTANT')",
      [COMPANY, checker],
    );
    await db.exec(
      readFileSync(
        `${repoRoot}/supabase/migrations/20260909000011_expense_correction_review_source.sql`,
        'utf8',
      ),
    );
    await db.exec('set role authenticated');
    const review = String(
      (
        await offsetFixtureCommand(db, 's08_create_frozen_review', {
          accounting_period_id: period,
          review_scope: { expense_ids: [expense] },
          dataset_lineage: 'browser-source-review',
        })
      ).id,
    );
    await db.query(
      "select public.s08_analyze_frozen_review($1::uuid,'{}','{}','[]')",
      [review],
    );
    await assumeIdentity(db, checker, COMPANY);
    await db.query('select public.s08_approve_frozen_review($1::uuid,$2)', [
      review,
      'Synthetic independent expense approval',
    ]);
    await assumeIdentity(db, MAKER, COMPANY);
    const correction = String(
      (
        await offsetFixtureCommand(db, 's09_create_correction_draft', {
          accounting_period_id: period,
          review_id: review,
          source_type: 'expense',
          source_id: expense,
          source_scope: { dataset_lineage: 'browser-source-review' },
          reason: 'Correct reviewed OWNER expense classification',
          amount: 30.125,
          debit_account_no: '1300',
          credit_account_no: '6100',
          request_id: 'browser-correction',
        })
      ).id,
    );
    await db.query('select public.s09_validate_correction($1::uuid)', [
      correction,
    ]);
    await db.query('select public.s09_apply_correction($1::uuid)', [
      correction,
    ]);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page);
    await installFinancialReads(page, db);
    for (const [day, amount] of [
      [8, '0.000'],
      [9, '30.125'],
    ] as const) {
      await page.goto(
        `/reports/financial-settlement-pack?view=statements&asOf=${at(day)}`,
      );
      await expect(page.getByText(/جاهز — 6 فحوص/)).toBeVisible();
      await page.getByText('تفاصيل المراجعة', { exact: true }).click();
      const cards = page.getByRole('list', {
        name: 'تفاصيل مراجعة الأرصدة المحاسبية',
      });
      const mobile = await cards.isVisible();
      const values = mobile
        ? cards
            .getByRole('listitem')
            .filter({ hasText: '1300' })
            .locator('span[dir="ltr"].tabular-nums')
        : page
            .getByRole('table', { name: 'تفاصيل مراجعة الأرصدة المحاسبية' })
            .getByRole('row')
            .filter({ hasText: '1300' })
            .getByRole('cell');
      await expect(values.nth(mobile ? 0 : 1)).toContainText(amount);
      await expect(values.nth(mobile ? 1 : 2)).toContainText(amount);
    }
  } finally {
    await db.close();
  }
});
