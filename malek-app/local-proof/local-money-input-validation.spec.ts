import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Loopback-only live proof for the money input validation fix: real local
// Supabase, real browser, no request interception.
const api = process.env.VITE_SUPABASE_URL!;
if (new URL(api).hostname !== '127.0.0.1') throw new Error('Loopback only');
const key = process.env.VITE_SUPABASE_ANON_KEY!;
const evidence = process.env.LOCAL_PROOF_EVIDENCE_DIR ?? 'test-results/local-proof-evidence';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill('local-maker@malek.test');
  await page.getByPlaceholder('••••••••').fill('local-fixture-not-for-production-2026');
  await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('malek-auth-session')!));
  return { apikey: key, Authorization: `Bearer ${session.access_token}` };
}

test('utility bill form preserves decimal typing and submits a validated amount', async ({ page }) => {
  test.setTimeout(60000);
  mkdirSync(evidence, { recursive: true });
  const headers = await login(page);
  await page.goto('/utilities');
  const addBill = page.getByRole('button', { name: 'فاتورة مرافق' });
  await expect(addBill).toBeEnabled({ timeout: 30000 });
  await addBill.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const property = dialog.locator('select').first();
  await property.selectOption({ index: 1 });
  const amount = dialog.locator('input[type="number"][required]');
  // The fixed controlled field keeps raw text: decimals must survive typing.
  await amount.fill('');
  await amount.pressSequentially('0.5', { delay: 60 });
  await expect(amount).toHaveValue('0.5');
  await dialog.locator('input[type="date"]').fill('2026-12-01');
  await page.screenshot({ path: `${evidence}/real-bill-form-decimal-typing.png` });
  await dialog.getByRole('button', { name: 'حفظ الفاتورة' }).click();
  await expect(dialog).toBeHidden({ timeout: 20000 });
  const response = await page.request.get(
    `${api}/rest/v1/utility_bills?amount=eq.0.5&select=id,amount&order=created_at.desc&limit=1`,
    { headers },
  );
  expect(response.status()).toBe(200);
  const rows = await response.json();
  expect(rows.length).toBeGreaterThan(0);
  expect(Number(rows[0].amount)).toBe(0.5);
  await page.screenshot({ path: `${evidence}/real-bill-created.png`, fullPage: true });
});
