import { expect, test } from '@playwright/test';
import { COMPANY, MAKER, CONTRACT, createOfficeCreditorFixture } from '../src/test/office-creditor-fixture';
import { createFixedFeeAgreementFixture } from '../src/test/fixed-fee-fixture';
import { createSqlReadBridge } from '../src/test/sql-read-bridge';
import { assumeIdentity } from '../src/p1/replay-bootstrap';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { installFakeSupabaseBackend } from './support/fake-supabase-backend';

// Auth/other modules retain the hermetic browser fixtures. The deposit data
// plane is NOT canned: real services execute replayed RPCs and read persisted
// PostgreSQL rows under authenticated role + a fixed validated fixture actor.
// This proves UI->command->persistence->register; it is not hosted GoTrue proof.
test('persisted deposit retry, credit statement and cash collection remain consistent', async ({ page }) => {
  test.setTimeout(120_000);
  const { db, invoiceId } = await createOfficeCreditorFixture({ taxRate: 5 });
  const month = new Date().toISOString().slice(0, 7);
  const earlier = `${month}-08`;
  const posting = `${month}-09`;
  try {
    await assumeIdentity(db, MAKER, COMPANY);
    await db.exec('set role authenticated');
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page);
    let loseFirstResponse = true;
    const requestIds: string[] = [];
    await page.route('**/rest/v1/rpc/create_deposit_atomic', async (route) => {
      const { p_payload } = route.request().postDataJSON();
      requestIds.push(p_payload.request_id);
      try {
        const { rows } = await db.query<{ data: unknown }>('select public.create_deposit_atomic($1::jsonb) as data', [JSON.stringify(p_payload)]);
        if (loseFirstResponse) { loseFirstResponse = false; await route.abort('failed'); return; }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[0].data) });
      } catch (error) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: String(error) }) });
      }
    });
    const reads: Record<string, string> = {
      contracts: `select c.id,c.tenant_id,c.property_id,c.unit_id,
        jsonb_build_object('id',p.id,'full_name',p.full_name) as people,
        jsonb_build_object('id',pr.id,'title',pr.title) as properties,
        jsonb_build_object('id',u.id,'unit_number',u.unit_number) as units
        from public.contracts c join public.people p on p.id=c.tenant_id
        join public.properties pr on pr.id=c.property_id left join public.units u on u.id=c.unit_id`,
      tenant_deposits: `select d.*, jsonb_build_object('people',jsonb_build_object('full_name',p.full_name)) as contracts,
        jsonb_build_object('title',pr.title) as properties,jsonb_build_object('unit_number',u.unit_number) as units
        from public.tenant_deposits d join public.contracts c on c.id=d.contract_id
        join public.people p on p.id=c.tenant_id join public.properties pr on pr.id=c.property_id
        left join public.units u on u.id=c.unit_id order by d.created_at desc,d.id desc`,
      deposit_application_claims: 'select * from public.deposit_application_claims',
      deposit_refund_events: 'select * from public.deposit_refund_events',
      contract_inspections: 'select * from public.contract_inspections',
    };
    await page.route(/\/rest\/v1\/(contracts|tenant_deposits|deposit_application_claims|deposit_refund_events|contract_inspections)(\?|$)/, async (route) => {
      const table = new URL(route.request().url()).pathname.split('/').pop()!;
      const { rows } = await db.query(reads[table]);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
    await page.goto('/financials?section=funds&view=deposits');
    await page.getByRole('button', { name: 'تسجيل وديعة جديدة', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'تسجيل وديعة تأمين جديدة' });
    await dialog.getByRole('combobox').selectOption(CONTRACT);
    await dialog.getByRole('spinbutton').fill('123.456');
    await dialog.locator('input[type=date]').fill(posting);
    await dialog.getByRole('button', { name: 'حفظ الوديعة', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await dialog.getByRole('button', { name: 'حفظ الوديعة', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(requestIds).toHaveLength(2);
    expect(requestIds[0]).toBe(requestIds[1]);
    await page.reload();
    await expect(page.getByText('P3 Tenant').first()).toBeVisible();
    await expect(page.getByText(/123\.456/).first()).toBeVisible();
    const { rows } = await db.query<{ count: string; balance: string }>('select count(*)::text, sum(remaining_amount)::text as balance from public.tenant_deposits');
    expect(rows[0]).toEqual({ count: '1', balance: '123.456' });
    const journal = await db.query<{ liability: string }>(`select sum(l.credit-l.debit)::text as liability from public.journal_lines l join public.accounts a on a.id=l.account_id where a.no='2200'`);
    expect(journal.rows[0].liability).toBe('123.456');

    // Continue through the report UI with an actual posted credit. Deposits
    // received (but not applied) must not reduce rent debt or look like cash.
    await db.query('select public.create_invoice_credit_atomic($1::jsonb)', [JSON.stringify({
      invoice_id: invoiceId, amount: 250.125, credit_type: 'PARTIAL',
      reason: 'Browser statement correction', request_id: 'browser-statement-credit', effective_date: posting,
    })]);
    await page.route('**/rest/v1/rpc/rpt_tenant_statement', async (route) => {
      const { p_contract_id } = route.request().postDataJSON();
      expect(p_contract_id).toBe(CONTRACT);
      const { rows } = await db.query<{ data: unknown }>('select public.rpt_tenant_statement($1::uuid) as data', [p_contract_id]);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[0].data) });
    });
    await page.goto(`/reports/tenant-statement?contractId=${CONTRACT}`);
    await expect(page.locator('[data-report-product-page="tenant-statement"]')).toBeVisible();
    await expect(page.getByText('إشعار دائن', { exact: true })).toBeVisible();
    await expect(page.getByText(/799\.875/).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('إشعار دائن', { exact: true })).toBeVisible();
    await expect(page.getByText(/799\.875/).first()).toBeVisible();

    const sqlRead = createSqlReadBridge(db);
    await page.route(/\/rest\/v1\/(invoices|payments|receipts|receipt_allocations)(\?|$)/, async route => {
      const url = new URL(route.request().url());
      const table = url.pathname.split('/').pop()!;
      const query = sqlRead(table).select('*');
      for (const [key, value] of url.searchParams) {
        if (value.startsWith('eq.')) query.eq(key, value.slice(3));
        else if (value.startsWith('in.(')) query.in(key, value.slice(4, -1).split(',').map(value => value.replace(/^"|"$/g, '')));
        else if (value === 'is.null') query.is(key, null);
      }
      const response = await query;
      if (response.error) throw response.error;
      let data = response.data as Record<string, unknown>[];
      if (table === 'invoices') {
        const context = (await db.query(reads.contracts)).rows[0];
        data = data.map(row => ({ ...row, contracts: context }));
      }
      const single = route.request().headers().accept?.includes('vnd.pgrst.object');
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, data.length - 1)}/${data.length}` }, body: JSON.stringify(single ? data[0] ?? null : data) });
    });
    await page.route('**/rest/v1/rpc/record_invoice_payment_atomic', async route => {
      const { payload } = route.request().postDataJSON();
      const { rows } = await db.query<{ data: unknown }>('select public.record_invoice_payment_atomic($1::jsonb) as data', [JSON.stringify(payload)]);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[0].data) });
    });
    await page.goto(`/financials?section=collections&view=invoices&invoiceId=${invoiceId}&collect=1`);
    await expect(page.locator('#quick-payment-amount')).toHaveValue('799.875');
    await page.locator('#quick-payment-amount').fill('123.456');
    await page.locator('#quick-payment-date').fill(posting);
    await page.locator('#quick-payment-form').getByRole('button', { name: 'تسجيل دفعة', exact: true }).click();
    await expect(page.getByText('تم تسجيل الدفعة بنجاح', { exact: true }).first()).toBeVisible();
    await page.goto(`/reports/tenant-statement?contractId=${CONTRACT}`);
    await expect(page.getByText(/676\.419/).first()).toBeVisible();
    await expect(page.getByText('دفعة / إيصال', { exact: true })).toBeVisible();
    const paid = await db.query<{ amount: string; count: number }>('select sum(amount)::text as amount, count(*)::integer as count from public.payments');
    expect(paid.rows[0]).toEqual({ amount: '123.456', count: 1 });

    // The readiness table and visible trial balance now cross the real SQL
    // boundary too. No canned balance/variance results are supplied here.
    await page.route('**/rest/v1/rpc/wp05_reconcile_all', async route => {
      const { p_as_of } = route.request().postDataJSON();
      const result = await db.query<{ data: unknown }>(
        'select to_jsonb(r) as data from public.wp05_reconcile_all(public.current_company_id(),$1::date) r', [p_as_of],
      );
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result.rows.map(row => row.data)) });
    });
    await page.route('**/rest/v1/rpc/rpt_trial_balance', async route => {
      const { p_as_of } = route.request().postDataJSON();
      const result = await db.query<{ data: unknown }>('select public.rpt_trial_balance($1::date) as data', [p_as_of]);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result.rows[0].data) });
    });
    const assertReadiness = async (ar: RegExp, deposit: RegExp) => {
      await expect(page.getByText(/جاهز — \d+ فحوص/)).toBeVisible();
      await page.getByText('تفاصيل المراجعة', { exact: true }).click();
      const cards = page.getByRole('list', { name: 'تفاصيل مراجعة الأرصدة المحاسبية' });
      if (await cards.isVisible()) {
        for (const [account, amount] of [['1201', ar], ['2200', deposit]] as const) {
          const values = cards.getByRole('listitem').filter({ hasText: account }).locator('span[dir="ltr"].tabular-nums');
          await expect(values.nth(0)).toContainText(amount);
          await expect(values.nth(1)).toContainText(amount);
        }
        return;
      }
      const evidence = page.getByRole('table', { name: 'تفاصيل مراجعة الأرصدة المحاسبية' });
      const arRow = evidence.getByRole('row').filter({ hasText: '1201' });
      const depositRow = evidence.getByRole('row').filter({ hasText: '2200' });
      for (const cell of [1, 2]) {
        await expect(arRow.getByRole('cell').nth(cell)).toContainText(ar);
        await expect(depositRow.getByRole('cell').nth(cell)).toContainText(deposit);
      }
    };
    await page.goto(`/reports/financial-settlement-pack?view=statements&asOf=${earlier}`);
    await assertReadiness(/1,050\.000/, /0\.000/);
    await page.reload();
    await assertReadiness(/1,050\.000/, /0\.000/);
    await page.goto(`/reports/financial-settlement-pack?view=statements&asOf=${posting}`);
    await assertReadiness(/676\.419/, /123\.456/);

    await page.route('**/rest/v1/rpc/rpt_vat_return', async route => {
      const { p_from_date, p_to_date } = route.request().postDataJSON();
      try {
        const result = await db.query<{ data: unknown }>('select public.rpt_vat_return($1::date,$2::date) as data', [p_from_date, p_to_date]);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result.rows[0].data) });
      } catch (error) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: String(error) }) });
      }
    });
    await page.goto(`/reports/financial-settlement-pack?view=financial-movement&from=${month}-01&to=${month}-28`);
    await expect(page.getByText('ملخص ضريبة القيمة المضافة', { exact: true })).toBeVisible();
    await expect(page.getByText(/761\.786/)).toBeVisible();
    await expect(page.getByText(/38\.089/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/38\.089/)).toBeVisible();

    // A trusted-server diagnostic posting with no tax source must surface an
    // error, not make the UI display zero tax or approve an invented tax base.
    await db.exec('reset role');
    try {
      const accounts = await db.query<{ id: string; no: string }>("select id,no from public.accounts where company_id=$1::uuid and no in ('1111','2100')", [COMPANY]);
      const id = (no: string) => accounts.rows.find(row => row.no===no)!.id;
      await db.query('select public.post_journal_event($1::jsonb)', [JSON.stringify({
        company_id: COMPANY, source_type: 'manual_adjustment', source_id: 'browser-tax-diagnostic', event_id: 'browser-tax-diagnostic', effective_date: posting,
        lines: [{ account_id: id('1111'), debit: 1, credit: 0 }, { account_id: id('2100'), debit: 0, credit: 1 }],
      })]);
    } finally { await db.exec('set role authenticated'); }
    await page.reload();
    await expect(page.getByText('تعذر تحميل ملخص الضريبة. لا تعتمد الأرقام حتى تكتمل مراجعة المصدر.', { exact: true })).toBeVisible();
    await expect(page.getByText('إجمالي الضريبة', { exact: true })).toHaveCount(0);
  } finally { await db.close(); }
});


test('fixed-fee UI survives lost acknowledgement, reload and compensating reversal', async ({ page }) => {
  test.setTimeout(120_000);
  const { db } = await createOfficeCreditorFixture();
  try {
    const from = await page.evaluate(() => {
      const date = new Date();
      return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-01`;
    });
    const [year, month] = from.split('-').map(Number);
    const days = new Date(year, month, 0).getDate();
    await createFixedFeeAgreementFixture(db, from, days*10);
    await installAcceptanceBrowser(page);
    await installFakeSupabaseBackend(page);
    let loseFirstExecutionResponse = true;
    await page.route(/\/rest\/v1\/rpc\/(list_fixed_monthly_accruals|execute_fixed_monthly_accruals_atomic|reverse_fixed_monthly_accrual_atomic)(\?|$)/, async route => {
      const name = new URL(route.request().url()).pathname.split('/').pop()!;
      const { p_payload } = route.request().postDataJSON();
      try {
        const { rows } = await db.query<{ data: unknown }>(`select public.${name}($1::jsonb) as data`, [JSON.stringify(p_payload)]);
        if (name === 'execute_fixed_monthly_accruals_atomic' && loseFirstExecutionResponse) {
          loseFirstExecutionResponse = false;
          await route.abort('failed');
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[0].data) });
      } catch (error) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: String(error) }) });
      }
    });
    await page.goto('/financials?section=fees&view=fixed_monthly_accruals');
    await page.locator('#fixed-accrual-from').fill(from);
    await page.locator('#fixed-accrual-to').fill(from);
    await page.getByRole('button', { name: 'احتساب الاستحقاقات', exact: true }).click();
    await expect(page.getByText('تعذر تنفيذ الاستحقاقات. راجع الإعدادات المطلوبة ثم أعد المحاولة.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'احتساب الاستحقاقات', exact: true }).click();
    await expect(page.getByText(/اكتمل التنفيذ:/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/10\.700/).first()).toBeVisible();
    await expect(page.getByText(/توجد استحقاقات تحتاج مراجعة ضريبية/)).toHaveCount(0);
    const totals = await db.query<{ count: number; tax: string }>('select count(*)::integer as count,sum(tax_amount)::text as tax from public.fixed_monthly_daily_accruals');
    expect(totals.rows[0]).toEqual({ count: 1, tax: '0.700' });

    const rowActions = page.getByRole('button', { name: /إجراءات استحقاق/ });
    if (!await rowActions.isVisible()) {
      await page.getByRole('list', { name: 'سجل استحقاقات أتعاب الإدارة الشهرية' }).getByRole('button', { name: /إجراءات/ }).first().click();
    }
    await rowActions.click();
    await page.getByRole('menuitem', { name: 'عكس', exact: true }).click();
    await page.locator('#fixed-accrual-reversal-reason').fill('تصحيح استحقاق الخدمة');
    await page.getByRole('button', { name: 'تأكيد العكس', exact: true }).click();
    await expect(page.getByText('تم تسجيل العكس مع الاحتفاظ بالاستحقاق الأصلي للمراجعة.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('تم العكس', { exact: true }).first()).toBeVisible();
    expect((await db.query('select id from public.fixed_monthly_daily_accrual_reversals')).rows).toHaveLength(1);
    expect((await db.query('select id from public.fixed_monthly_daily_accruals')).rows).toHaveLength(1);
    const vat = await db.query<{ data: { total_tax_amount: number } }>('select public.rpt_vat_return($1::date,$1::date) as data', [from]);
    expect(vat.rows[0].data.total_tax_amount).toBe(0);
  } finally { await db.close(); }
});
