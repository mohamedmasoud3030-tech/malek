import { expect, test } from '@playwright/test';
import {
  PROPERTY,
  createOfficeCreditorFixture,
} from '../src/test/office-creditor-fixture';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';

// Actual COMPANY expense commands/readback; auth and other modules are hermetic.
// This is not evidence that the separate OWNER classification debt is repaired.
test('expense retry retains intent and failed reads cannot become zero summaries or exports', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { db } = await createOfficeCreditorFixture();
  try {
    await db.exec('set role authenticated');
    await installAcceptanceBrowser(page);
    const seed = await installFakeSupabaseBackend(page);
    seed.tables.properties = (
      await db.query<Record<string, unknown>>('select * from public.properties')
    ).rows;
    let loseResponse = true;
    let readFailure = false;
    let failedReadAttempts = 0;
    const requestIds: string[] = [];
    await page.route(
      /\/rest\/v1\/rpc\/create_expense_with_journal_atomic(?:\?|$)/,
      async (route) => {
        const { p_payload } = route.request().postDataJSON();
        requestIds.push(p_payload.request_id);
        try {
          const { rows } = await db.query<{ data: unknown }>(
            'select public.create_expense_with_journal_atomic($1::jsonb) as data',
            [JSON.stringify(p_payload)],
          );
          if (loseResponse) {
            loseResponse = false;
            await route.abort('failed');
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(rows[0].data),
          });
        } catch (error) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ message: String(error) }),
          });
        }
      },
    );
    await page.route(/\/rest\/v1\/expenses(?:\?|$)/, async (route) => {
      if (readFailure) {
        failedReadAttempts += 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Expense read unavailable' }),
        });
        return;
      }
      const { rows } = await db.query(
        'select * from public.expenses where deleted_at is null order by expense_date desc,id',
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
    });
    const assertExport = async (disabled: boolean) => {
      const overflow = page.getByRole('button', {
        name: 'إجراءات إضافية',
        exact: true,
      });
      const mobile = await overflow.isVisible();
      if (mobile) await overflow.click();
      const button = page.getByRole('button', {
        name: 'تصدير CSV',
        exact: true,
      });
      if (disabled) await expect(button).toBeDisabled();
      else await expect(button).toBeEnabled();
      if (mobile)
        await page
          .locator('[data-secondary-actions-mobile]')
          .getByRole('button', { name: 'إغلاق', exact: true })
          .click();
    };
    await page.goto('/financials?section=expenses&view=expenses');
    await page
      .getByRole('button', { name: 'إضافة مصروف', exact: true })
      .click();
    await page.locator('select[name="property_id"]').selectOption(PROPERTY);
    await page.locator('input[name="amount"]').fill('20');
    await page
      .getByRole('button', { name: 'حفظ المصروف', exact: true })
      .click();
    await expect(
      page.getByText('تعذر تأكيد إضافة المصروف. راجع السجل ثم أعد المحاولة.', {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (await db.query('select id from public.expenses')).rows,
    ).toHaveLength(1);
    await page
      .getByRole('button', { name: 'حفظ المصروف', exact: true })
      .click();
    await expect(
      page.getByText('تم إضافة المصروف وترحيله محاسبياً', { exact: true }),
    ).toBeVisible();
    expect(requestIds).toHaveLength(2);
    expect(requestIds[0]).toBe(requestIds[1]);
    expect(
      (await db.query('select id from public.expenses')).rows,
    ).toHaveLength(1);
    await expect(page.locator('[aria-label="ملخص المصروفات"]')).toBeVisible();
    readFailure = true;
    await page.reload();
    // One initial read plus two application retries; no hidden SDK multiplier.
    await expect(
      page.getByRole('button', { name: 'إعادة المحاولة', exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    expect(failedReadAttempts).toBe(3);
    await expect(page.locator('[aria-label="ملخص المصروفات"]')).toHaveCount(0);
    await assertExport(true);
    readFailure = false;
    await page
      .getByRole('button', { name: 'إعادة المحاولة', exact: true })
      .click();
    await expect(page.locator('[aria-label="ملخص المصروفات"]')).toBeVisible();
    await assertExport(false);
  } finally {
    await db.close();
  }
});
