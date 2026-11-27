import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const api = process.env.VITE_SUPABASE_URL!;
if (new URL(api).hostname !== '127.0.0.1') throw new Error('Loopback only');
const key = process.env.VITE_SUPABASE_ANON_KEY!;
const evidence = process.env.LOCAL_PROOF_EVIDENCE_DIR ?? 'test-results/local-proof-evidence';
const owner = '00000000-0000-4000-8100-000000000001';
async function login(page: Page, identity: 'maker' | 'checker') {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill(`local-${identity}@malek.test`);
  await page.getByPlaceholder('••••••••').fill('local-fixture-not-for-production-2026');
  await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('malek-auth-session')!));
  return { apikey: key, Authorization: `Bearer ${session.access_token}` };
}
test('existing synthetic draft completes maker-checker approval and payout', async ({ page, browser }) => {
  test.setTimeout(90000);
  mkdirSync(evidence, { recursive: true });
  const headers = await login(page, 'maker');
  const read = async () => {
    const response = await page.request.get(`${api}/rest/v1/owner_settlements?owner_id=eq.${owner}&select=id,status,gross_collected,office_fee,net_payable,maker_user_id,checker_user_id,approved_by,paid_by,payment_reference,offset_applied&order=created_at.asc`, { headers });
    expect(response.status()).toBe(200);
    const rows = await response.json();
    expect(rows).toHaveLength(1);
    return rows[0];
  };
  let settlement = await read();
  const route = '/financials?section=funds&view=owner_settlements';
  if (settlement.status === 'DRAFT') {
    await page.goto(route);
    await page.getByRole('button', { name: /^إجراءات تسوية / }).first().click();
    const denial = page.waitForResponse(r => r.url().includes('/rpc/approve_owner_settlement_atomic'));
    await page.getByRole('menuitem', { name: 'اعتماد التسوية', exact: true }).click();
    const response = await denial;
    expect(response.status()).toBe(403);
    expect((await response.json()).message).toContain('MAKER_CHECKER_SELF_APPROVAL_DENIED');
    expect((await read()).status).toBe('DRAFT');
    await page.screenshot({ path: `${evidence}/real-settlement-maker-denied.png`, fullPage: true });
  }
  const checkerContext = await browser.newContext({ locale: 'ar-EG', viewport: { width: 1440, height: 1000 } });
  const checkerPage = await checkerContext.newPage();
  await login(checkerPage, 'checker');
  await checkerPage.goto(route);
  if (settlement.status === 'DRAFT') {
    await checkerPage.getByRole('button', { name: /^إجراءات تسوية / }).first().click();
    const approval = checkerPage.waitForResponse(r => r.url().includes('/rpc/approve_owner_settlement_atomic'));
    await checkerPage.getByRole('menuitem', { name: 'اعتماد التسوية', exact: true }).click();
    const response = await approval;
    expect(response.status(), await response.text()).toBe(200);
    await expect.poll(async () => (await read()).status).toBe('APPROVED');
    settlement = await read();
    expect(settlement.checker_user_id).not.toBe(settlement.maker_user_id);
    await checkerPage.screenshot({ path: `${evidence}/real-settlement-approved.png`, fullPage: true });
  }
  if (settlement.status === 'APPROVED') {
    await checkerPage.reload();
    await checkerPage.getByRole('button', { name: /^إجراءات تسوية / }).first().click();
    await checkerPage.getByRole('menuitem', { name: 'تسجيل صرف المستحق', exact: true }).click();
    const dialog = checkerPage.getByRole('dialog', { name: 'تسجيل صرف مستحق المالك', exact: true });
    await expect(dialog.getByText('معاينة الصرف', { exact: true })).toBeVisible();
    await dialog.getByPlaceholder('مثال: TR-902184 / CHK-102').fill(`LOCAL-SETTLEMENT-${settlement.id}`);
    await checkerPage.screenshot({ path: `${evidence}/real-settlement-payout-preview.png`, fullPage: true });
    const paid = checkerPage.waitForResponse(r => r.url().includes('/rpc/pay_owner_settlement_atomic'));
    await dialog.getByRole('button', { name: 'تأكيد الصرف', exact: true }).click();
    const response = await paid;
    expect(response.status(), await response.text()).toBe(200);
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await read()).status).toBe('PAID');
  }
  settlement = await read();
  expect(settlement.status).toBe('PAID');
  expect(settlement.maker_user_id).not.toBe(settlement.checker_user_id);
  expect(settlement.approved_by).toBe(settlement.checker_user_id);
  expect(settlement.paid_by).not.toBe(settlement.maker_user_id);
  expect(Number(settlement.net_payable)).toBe(594.111);
  await checkerPage.reload();
  await expect(checkerPage.getByText('مدفوعة للمالك', { exact: true }).first()).toBeVisible();
  await checkerPage.screenshot({ path: `${evidence}/real-settlement-paid.png`, fullPage: true });
  writeFileSync(`${evidence}/real-settlement-lifecycle.json`, JSON.stringify({ backend: 'real local Supabase', requestsMocked: false, settlement, verifiedAt: new Date().toISOString() }, null, 2));
  await checkerContext.close();
});
for (const width of [1440, 375]) {
  test(`owner report uses available width and tables remain reachable ${width}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 812 });
    await login(page, 'maker');
    await page.goto(`/reports/owner-comprehensive-statement?view=statement&ownerId=${owner}`);
    const product = page.locator('[data-report-product-page="owner-comprehensive-statement"]');
    await expect(product).toBeVisible();
    await expect(product.locator('.skeleton-shimmer')).toHaveCount(0, { timeout: 20000 });
    const productBox = await product.boundingBox();
    const panel = product.locator('[data-report-panel]').first();
    const panelBox = await panel.boundingBox();
    expect(panelBox!.width).toBeGreaterThan(productBox!.width * 0.95);
    const scrollRegions = product.locator('[data-report-table-scroll]');
    expect(await scrollRegions.count()).toBeGreaterThan(0);
    for (const region of await scrollRegions.all()) {
      await expect(region).toHaveAttribute('tabindex', '0');
      const accessible = await region.evaluate(el => {
        el.scrollLeft = -el.scrollWidth;
        const lastCell = el.querySelector('thead th:last-child');
        if (!lastCell) return true;
        const cell = lastCell.getBoundingClientRect();
        const container = el.getBoundingClientRect();
        const fits = cell.left >= container.left - 1 && cell.right <= container.right + 1;
        el.scrollLeft = 0;
        return fits;
      });
      expect(accessible).toBe(true);
    }
    await page.screenshot({ path: `${evidence}/real-owner-report-fixed-${width}.png`, fullPage: true });
  });
}
