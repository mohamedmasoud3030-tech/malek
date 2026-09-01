import { expect, type Page } from '@playwright/test';

export type ScreenshotValidity =
  | 'VALID'
  | 'INVALID — wrong route'
  | 'INVALID — wrong page identity'
  | 'INVALID — authentication/navigation failure'
  | 'INVALID — incomplete/loading state'
  | 'INVALID — obstructed by unrelated dialog/chrome';

export type ScreenshotValidityTarget = Readonly<{
  route: string;
  expectedUrlIncludes?: string;
  identityMarker: string;
  identityText?: string | RegExp;
  entityMarker?: string | RegExp;
  disallowMarkers?: readonly string[];
}>;

export type ScreenshotValidityResult = Readonly<{
  status: ScreenshotValidity;
  reason: string;
  url: string;
  marker: string;
}>;

/**
 * PR #1749 evidence contract: a screenshot is not proof until the page itself
 * proves route and identity. Filenames are never accepted as identity evidence.
 */
export async function classifyScreenshotTarget(page: Page, target: ScreenshotValidityTarget): Promise<ScreenshotValidityResult> {
  const url = page.url();
  const routeOk = target.expectedUrlIncludes ? url.includes(target.expectedUrlIncludes) : url.includes(target.route.split('?')[0]);
  if (!routeOk) {
    return { status: 'INVALID — wrong route', reason: `Expected URL to include ${target.expectedUrlIncludes ?? target.route}`, url, marker: target.identityMarker };
  }

  if (/\/login(?:\?|$)/.test(new URL(url).pathname + new URL(url).search) && !target.route.startsWith('/login?e2e-')) {
    return { status: 'INVALID — authentication/navigation failure', reason: 'Browser is on login instead of the requested authenticated screen.', url, marker: target.identityMarker };
  }

  const marker = page.locator(target.identityMarker).first();
  await marker.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  if ((await marker.count()) === 0 || !(await marker.isVisible().catch(() => false))) {
    return { status: 'INVALID — wrong page identity', reason: `Missing visible identity marker ${target.identityMarker}`, url, marker: target.identityMarker };
  }

  if (target.identityText) {
    await expect(marker).toContainText(target.identityText, { timeout: 10_000 });
  }

  if (target.entityMarker) {
    await expect(page.getByText(target.entityMarker).first()).toBeVisible({ timeout: 10_000 });
  }

  const loading = page.locator('[data-e2e-fixture-loading], [aria-busy="true"]').first();
  if ((await loading.count()) > 0 && (await loading.isVisible().catch(() => false))) {
    return { status: 'INVALID — incomplete/loading state', reason: 'Loading marker is still visible.', url, marker: target.identityMarker };
  }

  for (const selector of target.disallowMarkers ?? []) {
    const obstruction = page.locator(selector).first();
    if ((await obstruction.count()) > 0 && (await obstruction.isVisible().catch(() => false))) {
      return { status: 'INVALID — obstructed by unrelated dialog/chrome', reason: `Unexpected obstruction ${selector} is visible.`, url, marker: target.identityMarker };
    }
  }

  return { status: 'VALID', reason: 'Route, identity marker and loading/auth checks passed.', url, marker: target.identityMarker };
}

export async function expectValidScreenshotTarget(page: Page, target: ScreenshotValidityTarget) {
  const result = await classifyScreenshotTarget(page, target);
  expect(result, result.reason).toMatchObject({ status: 'VALID' });
  return result;
}
