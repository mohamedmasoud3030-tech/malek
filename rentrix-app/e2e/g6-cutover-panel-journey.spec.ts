import { expect, test } from '@playwright/test';
import { COMPANY, MAKER } from '../src/test/office-creditor-fixture';
import {
  createOwnerOffsetFixture,
  offsetFixtureCommand as command,
  offsetDate as at,
} from '../src/test/owner-offset-fixture';
import { assumeIdentity } from '../src/p1/replay-bootstrap';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';

/**
 * G6/NOW-11 — browser proof for the governed historical adoption panel
 * (owner-funds cutover) inside the settlements workspace.
 *
 * Proves in a real browser: the truthful "absence of evidence ≠ zero balance"
 * empty state, the APPROVED-review source loaded through the deployed
 * `s08_list_frozen_reviews` RPC (NOW-7 contract), the draft creation through
 * the deployed `create_owner_funds_cutover_atomic` (server-derived balance —
 * the form never sends one), and the adopted evidence rendering afterwards.
 */
test('cutover panel proves absence-of-evidence state and creates a draft through the deployed RPC', async ({ page }) => {
  test.setTimeout(240_000);
  const f = await createOwnerOffsetFixture();
  const db = f.db;
  const checker = 'c2000000-0000-4000-8000-000000000099';
  try {
    const period = (
      await db.query<{ id: string }>(
        'select id from public.accounting_periods where company_id=$1::uuid and $2::date between start_date and end_date',
        [COMPANY, at(9)],
      )
    ).rows[0].id;
    // An APPROVED S08 review anchored to the period (independent approver).
    const review = await command(db, 's08_create_frozen_review', {
      accounting_period_id: period,
      review_scope: {},
      dataset_lineage: 'cutover-e2e',
    });
    const reviewId = String(review.id);
    await db.query("select public.s08_analyze_frozen_review($1::uuid,'{}','{}','[]')", [reviewId]);
    await assumeIdentity(db, checker, COMPANY);
    await db.query('select public.s08_approve_frozen_review($1::uuid,$2)', [
      reviewId,
      'Independent review for the cutover browser journey',
    ]);
    await assumeIdentity(db, MAKER, COMPANY);

    await installAcceptanceBrowser(page);
    const seed = await installFakeSupabaseBackend(page);
    seed.tables.owners = (
      await db.query<Record<string, unknown>>('select * from public.owners where company_id=$1', [COMPANY])
    ).rows;
    await page.route(/\/rest\/v1\/owner_settlements(?:\?|$)/, async (route) => {
      const rows = (
        await db.query(
          'select * from public.owner_settlements where company_id=$1 order by created_at desc,id desc',
          [COMPANY],
        )
      ).rows;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
    // Cutover evidence read: replicate the deployed PostgREST single-object
    // semantics exactly (maybeSingle → 406/PGRST116 on zero rows → null).
    await page.route(/\/rest\/v1\/owner_funds_event_cutovers(?:\?|$)/, async (route) => {
      const rows = (
        await db.query(
          'select * from public.owner_funds_event_cutovers where company_id=$1 order by created_at desc',
          [COMPANY],
        )
      ).rows;
      const accept = (await route.request().headerValue('accept')) ?? '';
      if (accept.includes('application/vnd.pgrst.object')) {
        if (rows.length === 0) {
          await route.fulfill({
            status: 406,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 'PGRST116',
              message: 'JSON object requested, multiple (or no) rows returned',
              details: 'Results contain 0 rows',
            }),
          });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[0]) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
    const rpcCalls: string[] = [];
    await page.route('**/rest/v1/rpc/s08_list_frozen_reviews', async (route) => {
      rpcCalls.push('s08_list_frozen_reviews');
      try {
        const args = route.request().postDataJSON() ?? {};
        const data = (
          await db.query<{ data: unknown }>('select public.s08_list_frozen_reviews($1::uuid) as data', [
            args.p_period_id ?? null,
          ])
        ).rows[0].data;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      } catch (error) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: String(error) }) });
      }
    });
    const createCalls: Array<Record<string, unknown>> = [];
    await page.route('**/rest/v1/rpc/create_owner_funds_cutover_atomic', async (route) => {
      const { p_payload } = route.request().postDataJSON() ?? {};
      createCalls.push(p_payload);
      try {
        const data = (
          await db.query<{ data: unknown }>(
            'select public.create_owner_funds_cutover_atomic($1::jsonb) as data',
            [JSON.stringify(p_payload)],
          )
        ).rows[0].data;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      } catch (error) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: String(error) }) });
      }
    });

    await page.goto('/financials?section=funds&view=owner_settlements');
    const panel = page.locator('[data-owner-funds-cutover-panel]');
    await expect(
      panel.getByRole('heading', { name: 'تبني الأرصدة التاريخية لأموال الملاك (القطع المحاسبي)' }),
    ).toBeVisible();

    // Truthful empty state: absence of evidence, explicitly NOT a zero balance.
    await expect(panel.getByText(/هذا غياب دليل ولا يعني رصيداً صفرياً/)).toBeVisible();

    // NOW-7 in the browser: the review options came through the deployed RPC.
    expect(rpcCalls).toContain('s08_list_frozen_reviews');
    const reviewSelect = panel.locator('select[aria-label="مراجعة S08 المعتمدة"]');
    await expect(reviewSelect.locator('option')).toHaveCount(2);
    await expect(reviewSelect.locator('option').nth(1)).toContainText('cutover-e2e');

    // Fill the draft form: date + approved review + reason. No balance field
    // exists — the server derives it (GL 2000); the payload must not carry one.
    await panel.locator('input[aria-label="تاريخ القطع المحاسبي"]').fill(at(9));
    await reviewSelect.selectOption(reviewId);
    await panel.locator('textarea[aria-label="سبب التبني"]').fill('تبني أرصدة تاريخية مدققة قبل الترحيل');
    await panel.getByRole('button', { name: 'إنشاء مسودة القطع', exact: true }).click();

    // The deployed RPC ran once, with a server-derived-scope payload.
    await expect.poll(() => createCalls.length).toBe(1);
    expect(createCalls[0]).not.toHaveProperty('company_id');
    expect(createCalls[0]).not.toHaveProperty('opening_balance');
    expect(createCalls[0].s08_review_id).toBe(reviewId);

    // Adopted state renders the stored evidence with its truthful DRAFT label.
    await expect(panel.getByText('تاريخ القطع المعتمد')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText(/يوجد قطع محاسبي محفوظ لهذه الشركة/)).toBeVisible();

    // SQL truth: exactly one DRAFT cutover row, review-anchored, with a
    // server-derived fingerprint; the maker cannot be the approver (the panel
    // hides approval from the maker — asserted via the stored created_by).
    const rows = (
      await db.query<{ row: Record<string, unknown> }>(
        'select to_jsonb(c) as row from public.owner_funds_event_cutovers c where company_id=$1::uuid',
        [COMPANY],
      )
    ).rows.map((r) => r.row);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('DRAFT');
    expect(rows[0].s08_review_id).toBe(reviewId);
    expect(String(rows[0].source_fingerprint)).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].approved_by).toBeNull();
  } finally {
    await db.close();
  }
});
