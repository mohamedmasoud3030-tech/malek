import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { COMPANY, MAKER, PROPERTY, createOfficeCreditorFixture } from '../src/test/office-creditor-fixture';
import { offsetFixtureCommand as command, offsetDate as at } from '../src/test/owner-offset-fixture';
import { assumeIdentity, repoRoot } from '../src/p1/replay-bootstrap';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';

// NOTE: deliberately no import from src/features/**/services — those modules
// pull in `@/lib/supabase`, whose `import.meta.env` is undefined under the
// Playwright node transform. The draft payload below mirrors
// `buildCreateS09DraftPayload` key-for-key (contract locked by the pglite suite).

/**
 * G5/NOW-11 — browser proof for the S09 correction panel.
 *
 * Drives the REAL panel through the FULL lifecycle (DRAFT → VALIDATED →
 * APPLIED → REVERSED) against the DEPLOYED server functions replayed in
 * PGlite — every mutation the browser performs executes the same SQL the
 * pglite suite locks (NOW-4/5/7), and the review source loads through the
 * deployed `s08_list_frozen_reviews` RPC (NOW-7 contract, incl. its
 * `{company_id, reviews:[…]}` envelope parsed by the client).
 */
test('S09 panel drives the full correction lifecycle through the deployed functions', async ({ page }) => {
  test.setTimeout(240_000);
  const { db } = await createOfficeCreditorFixture({ throughMigration: '20260909000011' });
  const checker = 'c2000000-0000-4000-8000-000000000097';
  try {
    // Mirror the s09 pglite suite setup exactly (same server state).
    await db.query('insert into auth.users(id,email) values($1::uuid,$2)', [checker, 's09-e2e-checker@test.local']);
    await db.query(
      "insert into public.users(id,email,name,role,status,is_active) values($1::uuid,$2,'S09 e2e checker','ACCOUNTANT','ACTIVE',true)",
      [checker, 's09-e2e-checker@test.local'],
    );
    await db.query(
      "insert into public.company_members(company_id,user_id,role) values($1::uuid,$2::uuid,'ACCOUNTANT')",
      [COMPANY, checker],
    );
    await db.exec('set role authenticated');
    const expense = String(
      (
        await command(db, 'create_expense_with_journal_atomic', {
          property_id: PROPERTY,
          category: 'صيانة',
          charged_to: 'OWNER',
          amount: 30.125,
          expense_date: at(9),
          request_id: 's09-e2e-expense',
        })
      ).expense_id,
    );
    const period = (
      await db.query<{ id: string }>(
        'select id from public.accounting_periods where company_id=$1::uuid and $2::date between start_date and end_date',
        [COMPANY, at(9)],
      )
    ).rows[0].id;
    await db.exec('reset role');
    await db.exec(
      readFileSync(`${repoRoot}/supabase/migrations/20260909000012_owner_expense_allocation_source.sql`, 'utf8'),
    );
    await db.exec('set role authenticated');
    await assumeIdentity(db, MAKER, COMPANY);

    // An APPROVED S08 review: created by MAKER, analyzed, approved by the
    // independent ACCOUNTANT (migration-11 independent-reviewer gate).
    const review = await command(db, 's08_create_frozen_review', {
      accounting_period_id: period,
      review_scope: { expense_ids: [expense] },
      dataset_lineage: 's09-e2e',
    });
    const reviewId = String(review.id);
    await db.query("select public.s08_analyze_frozen_review($1::uuid,'{}','{}','[]')", [reviewId]);
    await assumeIdentity(db, checker, COMPANY);
    await db.query('select public.s08_approve_frozen_review($1::uuid,$2)', [
      reviewId,
      'Independent review for the browser journey',
    ]);
    await assumeIdentity(db, MAKER, COMPANY);

    // One seeded DRAFT correction; the browser walks it through the lifecycle.
    const originalBatch = (
      await db.query<{ id: string }>(
        `select b.id::text as id from public.journal_batches b
          where b.source_type='expense' and b.source_id=$1 limit 1`,
        [expense],
      )
    ).rows[0].id;
    const seeded = await command(db, 's09_create_correction_draft', {
      review_id: reviewId,
      source_type: 'expense',
      source_id: expense,
      reason: 'إعادة تصنيف مصروف معتمد',
      amount: 30.125,
      debit_account_no: '1300',
      credit_account_no: '6100',
      request_id: 's09-e2e-draft',
      accounting_period_id: period,
      original_journal_batch_id: originalBatch,
    });
    const correctionId = String(seeded.id);
    const originalBefore = (
      await db.query<{ batch: unknown; lines: unknown }>(
        `select to_jsonb(b) as batch,
                coalesce((select jsonb_agg(to_jsonb(l) order by l.no) from public.journal_lines l where l.batch_id=b.id),'[]'::jsonb) as lines
           from public.journal_batches b where b.id=$1::uuid`,
        [originalBatch],
      )
    ).rows[0];

    await installAcceptanceBrowser(page);
    const seed = await installFakeSupabaseBackend(page);
    seed.tables.properties = (
      await db.query<Record<string, unknown>>('select * from public.properties')
    ).rows;
    await page.route(/\/rest\/v1\/expenses(?:\?|$)/, async (route) => {
      const rows = (await db.query('select * from public.expenses order by expense_date desc,id')).rows;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });

    // Bridge every S08/S09 RPC the panel touches to the DEPLOYED function.
    const rpcCalls: string[] = [];
    const bridge = (name: string, run: (args: Record<string, unknown>) => Promise<unknown>) =>
      page.route(`**/rest/v1/rpc/${name}`, async (route) => {
        rpcCalls.push(name);
        try {
          const data = await run(route.request().postDataJSON() ?? {});
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
        } catch (error) {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: String(error) }) });
        }
      });
    await bridge('s09_list_corrections', async (args) =>
      (
        await db.query<{ data: unknown }>(
          'select public.s09_list_corrections($1::uuid,$2::text) as data',
          [args.p_period_id ?? null, args.p_status ?? null],
        )
      ).rows[0].data,
    );
    await bridge('s08_list_frozen_reviews', async (args) =>
      (
        await db.query<{ data: unknown }>('select public.s08_list_frozen_reviews($1::uuid) as data', [
          args.p_period_id ?? null,
        ])
      ).rows[0].data,
    );
    await bridge('s09_create_correction_draft', async (args) =>
      (
        await db.query<{ data: unknown }>('select public.s09_create_correction_draft($1::jsonb) as data', [
          JSON.stringify(args.p_payload),
        ])
      ).rows[0].data,
    );
    await bridge('s09_validate_correction', async (args) =>
      (
        await db.query<{ data: unknown }>('select public.s09_validate_correction($1::uuid) as data', [
          args.p_correction_id,
        ])
      ).rows[0].data,
    );
    await bridge('s09_apply_correction', async (args) =>
      (
        await db.query<{ data: unknown }>('select public.s09_apply_correction($1::uuid) as data', [
          args.p_correction_id,
        ])
      ).rows[0].data,
    );
    await bridge('s09_reverse_correction', async (args) =>
      (
        await db.query<{ data: unknown }>('select public.s09_reverse_correction($1::uuid,$2) as data', [
          args.p_correction_id,
          args.p_reason,
        ])
      ).rows[0].data,
    );

    await page.goto('/financials?section=expenses&view=expenses');
    const panel = page.locator('section[aria-labelledby="s09-heading"]');
    await expect(panel.getByRole('heading', { name: 'تصحيحات محاسبية بعد الإقفال (S09)' })).toBeVisible();

    // The seeded DRAFT renders with its truthful status and reason.
    await expect(panel.getByText('مسودة', { exact: true })).toBeVisible();
    await expect(panel.getByText('السبب: إعادة تصنيف مصروف معتمد')).toBeVisible();

    // NOW-7 in the browser: the review source loaded through the deployed
    // list RPC — the draft form's review select offers exactly the APPROVED review.
    expect(rpcCalls).toContain('s08_list_frozen_reviews');
    const reviewSelect = panel.locator('select[aria-label="مراجعة S08 المعتمدة"], select').first();
    await expect(reviewSelect.locator('option')).toHaveCount(2);

    // DRAFT → VALIDATED through the real deployed function.
    await panel.getByRole('button', { name: 'تحقق من التصحيح', exact: true }).click();
    await expect(panel.getByText('مُتحقَّق منها', { exact: true })).toBeVisible({ timeout: 15_000 });

    // VALIDATED → APPLIED: the correction batch reference appears on the row.
    await panel.getByRole('button', { name: 'تطبيق وترحيل القيد', exact: true }).click();
    await expect(panel.getByText('مُطبَّقة', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText(/قيد التصحيح:/)).toBeVisible();

    // APPLIED → REVERSED: the truthfulness gate first — no reason, no reversal.
    await panel.getByRole('button', { name: 'عكس التصحيح', exact: true }).click();
    const confirmReverse = panel.getByRole('button', { name: 'تأكيد العكس وترحيل قيد تعويضي', exact: true });
    await expect(confirmReverse).toBeDisabled();
    await panel
      .getByRole('textbox', { name: 'سبب العكس (يُسجَّل في الدليل ولا يمكن تركه فارغاً)' })
      .fill('تراجع عن إعادة التصنيف بعد مراجعة المالك');
    await expect(confirmReverse).toBeEnabled();
    await confirmReverse.click();
    await expect(panel.getByText('معكوسة', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText(/قيد العكس:/)).toBeVisible();

    // SQL truth after the browser journey: the stored row carries the full
    // 3-batch lineage, and the ORIGINAL posting is byte-identical (NOW-4 proof,
    // now reached through real UI interaction).
    const stored = (
      await db.query<{ row: Record<string, unknown> }>(
        'select to_jsonb(c) as row from public.s09_corrections c where id=$1::uuid',
        [correctionId],
      )
    ).rows[0].row;
    expect(stored.status).toBe('REVERSED');
    expect(stored.original_journal_batch_id).toBe(originalBatch);
    expect(stored.correction_journal_batch_id).toBeTruthy();
    expect(stored.reversal_journal_batch_id).toBeTruthy();
    const originalAfter = (
      await db.query<{ batch: unknown; lines: unknown }>(
        `select to_jsonb(b) as batch,
                coalesce((select jsonb_agg(to_jsonb(l) order by l.no) from public.journal_lines l where l.batch_id=b.id),'[]'::jsonb) as lines
           from public.journal_batches b where b.id=$1::uuid`,
        [originalBatch],
      )
    ).rows[0];
    expect(originalAfter).toEqual(originalBefore);
    const compensating = (
      await db.query<{ row: Record<string, unknown> }>(
        'select to_jsonb(b) as row from public.journal_batches b where id=$1::uuid',
        [String(stored.reversal_journal_batch_id)],
      )
    ).rows[0].row;
    expect(compensating.status).toBe('POSTED');
    expect(compensating.source_type).toBe('journal_reversal');
    expect(compensating.reversal_of_batch_id).toBe(stored.correction_journal_batch_id);
  } finally {
    await db.close();
  }
});
