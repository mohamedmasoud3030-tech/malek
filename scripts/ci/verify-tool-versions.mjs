import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Keep this guard strict: CI must use the exact tool versions resolved by the lockfile.
const EXPECTED_SUPABASE = '2.105.0';
const EXPECTED_PLAYWRIGHT = '1.61.1';

const rootPackage = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const appPackage = JSON.parse(readFileSync(resolve('rentrix-app/package.json'), 'utf8'));
const lockfile = readFileSync(resolve('pnpm-lock.yaml'), 'utf8');

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} must be exactly ${expected}; received ${actual ?? '(missing)'}.`);
  }
}

assertEqual(rootPackage.devDependencies?.supabase, EXPECTED_SUPABASE, 'package.json supabase');
assertEqual(appPackage.devDependencies?.['@playwright/test'], EXPECTED_PLAYWRIGHT, 'rentrix-app/package.json @playwright/test');

if (!lockfile.includes(`supabase:\n        specifier: ${EXPECTED_SUPABASE}\n        version: ${EXPECTED_SUPABASE}`)) {
  throw new Error('pnpm-lock.yaml does not pin the expected Supabase CLI specifier.');
}
if (!lockfile.includes(`'@playwright/test':\n        specifier: ${EXPECTED_PLAYWRIGHT}\n        version: ${EXPECTED_PLAYWRIGHT}`)) {
  throw new Error('pnpm-lock.yaml does not pin the expected Playwright specifier.');
}

const supabaseVersion = execFileSync('pnpm', ['exec', 'supabase', '--version'], { encoding: 'utf8' }).trim();
const playwrightVersion = execFileSync(
  'pnpm',
  ['--filter', './rentrix-app', 'exec', 'playwright', '--version'],
  { encoding: 'utf8' },
).trim();

assertEqual(supabaseVersion, EXPECTED_SUPABASE, 'installed Supabase CLI');
assertEqual(playwrightVersion, `Version ${EXPECTED_PLAYWRIGHT}`, 'installed Playwright');

console.log(`Pinned tools: Supabase ${EXPECTED_SUPABASE}, Playwright ${EXPECTED_PLAYWRIGHT}`);
