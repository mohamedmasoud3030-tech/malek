/* Responsive smoke check — login page at phone + desktop widths. */
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const results = [];

  for (const viewport of [
    { name: 'phone-390', width: 390, height: 844 },
    { name: 'desktop-1440', width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('[data-login-surface]', { timeout: 30000 });
    await page.screenshot({ path: `/tmp/login-${viewport.name}.png`, fullPage: true });

    // Structural assertions
    const hasCard = await page.locator('[data-login-card]').count();
    const hasSplit = await page.locator('[data-command-center-panel]').count();
    const title = await page.locator('h1').textContent().catch(() => '');
    const btnVisible = await page.locator('button[type="submit"]').isVisible();
    const pwToggle = await page.locator('button[aria-label*="كلمة المرور"]').count();

    // Horizontal overflow check (the "no horizontal app scrolling" rule)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    // Card fits viewport (no clipping)
    const cardBox = await page.locator('[data-login-card]').boundingBox();
    const fits = cardBox && cardBox.width <= viewport.width - 16 && cardBox.height < viewport.height;

    results.push({
      viewport: viewport.name,
      hasCard: hasCard === 1,
      splitPanelGone: hasSplit === 0,
      heading: title?.trim() ?? '',
      submitVisible: btnVisible,
      pwToggle: pwToggle === 1,
      hOverflowPx: overflow,
      cardFitsViewport: fits,
      jsErrors: errors.length,
    });
    await page.close();
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => { console.error('SMOKE FAIL', e); process.exit(1); });
