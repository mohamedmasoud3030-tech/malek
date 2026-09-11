import { expect, test } from '@playwright/test';
import { COMPANY, MAKER, OWNER } from '../src/test/office-creditor-fixture';
import {
  createOwnerOffsetFixture,
  offsetFixtureCommand as command,
  offsetDate as at,
} from '../src/test/owner-offset-fixture';
import { assumeIdentity } from '../src/p1/replay-bootstrap';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';

/**
 * G5/NOW-12 — browser proof for the owner receivable RECOVERY panel, the last
 * G5/G6 panel without browser coverage, plus the first browser-proven
 * fail-closed refusal: a concurrent lawful recovery makes the open UI stale,
 * the server refuses the over-outstanding submit with its Arabic reason, and
 * NO state changes — then the honest remainder succeeds with full SQL truth.
 *
 * No payload is tampered with anywhere: the refusal is produced by real
 * concurrency against the deployed `recover_owner_receivable_atomic` guards.
 */
test('recovery panel proves stale-UI refusal and lawful cash recovery through the deployed RPC', async ({ page }) => {
  test.setTimeout(240_000);
  const f = await createOwnerOffsetFixture();
  const db = f.db;
  try {
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
    // Recovery/offset panel reads: honour the PostgREST eq filters the
    // deployed loaders send (owner_id / due_from_owner_id).
    const tableRoute = (table: 'due_from_owners' | 'due_from_owner_recoveries' | 'due_from_owner_offsets', filter: string) =>
      page.route(new RegExp(`/rest/v1/${table}(?:\\?|$)`), async (route) => {
        const url = new URL(route.request().url());
        const eq = url.searchParams.get(filter);
        const params: unknown[] = [COMPANY];
        let where = 'company_id=$1::uuid';
        if (eq?.startsWith('eq.')) {
          where += ` and ${filter}=$2::uuid`;
          params.push(eq.slice(3));
        }
        const rows = (
          await db.query(
            `select * from public.${table} where ${where} order by created_at desc,id desc`,
            params,
          )
        ).rows;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
      });
    await tableRoute('due_from_owners', 'owner_id');
    await tableRoute('due_from_owner_recoveries', 'due_from_owner_id');
    await tableRoute('due_from_owner_offsets', 'due_from_owner_id');
    // The cutover panel mounts in the same workspace and reads its evidence
    // table + the deployed review list; bridge both so the workspace is whole.
    await page.route(/\/rest\/v1\/owner_funds_event_cutovers(?:\?|$)/, async (route) => {
      const accept = (await route.request().headerValue('accept')) ?? '';
      if (accept.includes('application/vnd.pgrst.object')) {
        await route.fulfill({
          status: 406,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'Results contain 0 rows' }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/rpc/s08_list_frozen_reviews', async (route) => {
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
    const recoverCalls: Array<Record<string, unknown>> = [];
    await page.route('**/rest/v1/rpc/recover_owner_receivable_atomic', async (route) => {
      const { p_payload } = route.request().postDataJSON() ?? {};
      recoverCalls.push(p_payload);
      try {
        const data = (
          await db.query<{ data: unknown }>(
            'select public.recover_owner_receivable_atomic($1::jsonb) as data',
            [JSON.stringify(p_payload)],
          )
        ).rows[0].data;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      } catch (error) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: String(error) }) });
      }
    });

    await page.goto(`/financials?section=funds&view=owner_settlements&ownerId=${OWNER}`);
    const panel = page.locator('section[aria-labelledby="owner-recovery-heading"]');
    await expect(panel.getByRole('heading', { name: 'تحصيل نقدي لمديونيات الملاك' })).toBeVisible();

    // The seeded receivable renders in the picker; select it.
    const receivableSelect = panel.locator('select').first();
    await expect(receivableSelect.locator('option')).toHaveCount(2);
    await receivableSelect.selectOption(f.receivable);

    // Truthful summary before any recovery: 200 original, 0 recovered.
    await expect(panel.locator('[data-recovery-original]')).toContainText('200');
    await expect(panel.locator('[data-recovery-recovered]')).toContainText('0');
    await expect(panel.locator('[data-recovery-outstanding]')).toContainText('200');
    await expect(panel.getByText('سيظهر هنا سجل حركات التحصيل', { exact: false })).toBeVisible();

    // --- Fail-closed refusal via REAL concurrency (no tampering) ---
    // A concurrent accountant lawfully recovers 150 straight through the
    // deployed RPC while this browser still shows outstanding = 200.
    const batchesBefore = (
      await db.query<{ n: string }>('select count(*)::text as n from public.journal_batches where company_id=$1', [COMPANY])
    ).rows[0].n;
    await command(db, 'recover_owner_receivable_atomic', {
      due_from_owner_id: f.receivable,
      amount: 150,
      effective_date: at(5),
      cash_account_no: '1111',
      request_id: 'recovery-concurrent',
    });

    // The stale UI submits the full 200 — the server must refuse with its
    // Arabic reason and change nothing.
    const form = panel.locator('form');
    await form.locator('input[type="number"]').fill('200');
    await form.locator('input[type="date"]').fill(at(9));
    const submit = panel.getByRole('button', { name: 'تسجيل التحصيل', exact: true });
    await submit.click();
    await expect(panel.getByRole('alert')).toContainText(
      'المبلغ يتجاوز الرصيد المتبقي من المديونية الأصلية.',
      { timeout: 15_000 },
    );

    // SQL truth: the refused submit changed NOTHING (only the concurrent 150).
    const afterRefusal = (
      await db.query<{ row: Record<string, unknown> }>(
        'select to_jsonb(d) as row from public.due_from_owners d where id=$1::uuid',
        [f.receivable],
      )
    ).rows[0].row;
    expect(Number(afterRefusal.outstanding)).toBe(50);
    expect(Number(afterRefusal.recovered_amount)).toBe(150);
    const recoveriesAfterRefusal = (
      await db.query<{ n: string }>(
        'select count(*)::text as n from public.due_from_owner_recoveries where due_from_owner_id=$1',
        [f.receivable],
      )
    ).rows[0].n;
    expect(recoveriesAfterRefusal).toBe('1');
    const batchesAfterRefusal = (
      await db.query<{ n: string }>('select count(*)::text as n from public.journal_batches where company_id=$1', [COMPANY])
    ).rows[0].n;
    expect(batchesAfterRefusal).toBe(String(Number(batchesBefore) + 1)); // concurrent batch only

    // The refused payload never carried server-owned fields.
    expect(recoverCalls.length).toBeGreaterThanOrEqual(1);
    for (const payload of recoverCalls) {
      expect(payload).not.toHaveProperty('company_id');
      expect(payload).not.toHaveProperty('amount_override');
      expect(payload).not.toHaveProperty('target_account');
    }

    // --- Honest remainder succeeds ---
    await form.locator('input[type="number"]').fill('50');
    await submit.click();
    // NOTE: scope by text, not getByRole('status') — the movements empty-state
    // wrapper also carries role="status" (strict-mode collision).
    await expect(panel.getByText(/تم تسجيل التحصيل وتُرحّل القيد/)).toBeVisible({
      timeout: 15_000,
    });

    // Both movements are listed with their accounts; UI re-read the truth.
    await expect(panel.locator('[data-recovery-recovered]')).toContainText('200');
    await expect(panel.locator('[data-recovery-outstanding]')).toContainText('0');

    // SQL truth: fully recovered, two lawful movements, both batches POSTED.
    const final = (
      await db.query<{ row: Record<string, unknown> }>(
        'select to_jsonb(d) as row from public.due_from_owners d where id=$1::uuid',
        [f.receivable],
      )
    ).rows[0].row;
    expect(final.status).toBe('RECOVERED');
    expect(Number(final.outstanding)).toBe(0);
    expect(Number(final.recovered_amount)).toBe(200);
    const movements = (
      await db.query<{ row: Record<string, unknown> }>(
        'select to_jsonb(r) as row from public.due_from_owner_recoveries r where due_from_owner_id=$1 order by effective_date',
        [f.receivable],
      )
    ).rows.map((r) => r.row);
    expect(movements).toHaveLength(2);
    expect(movements.map((m) => Number(m.amount))).toEqual([150, 50]);
    const posted = (
      await db.query<{ n: string }>(
        `select count(*)::text as n from public.journal_batches b
          where b.company_id=$1 and b.id in (select journal_batch_id from public.due_from_owner_recoveries where due_from_owner_id=$2)
          and b.status='POSTED'`,
        [COMPANY, f.receivable],
      )
    ).rows[0].n;
    expect(posted).toBe('2');
  } finally {
    await db.close();
  }
});
