import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  COMPANY,
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
