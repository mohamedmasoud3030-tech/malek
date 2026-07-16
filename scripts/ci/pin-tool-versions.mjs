import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SUPABASE_VERSION = '2.105.0';
const PLAYWRIGHT_VERSION = '1.61.1';

function updateJson(path, mutate) {
  const absolutePath = resolve(path);
  const value = JSON.parse(readFileSync(absolutePath, 'utf8'));
  mutate(value);
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

updateJson('package.json', (pkg) => {
  pkg.devDependencies.supabase = SUPABASE_VERSION;
});

updateJson('rentrix-app/package.json', (pkg) => {
  pkg.devDependencies['@playwright/test'] = PLAYWRIGHT_VERSION;
});

const lockfilePath = resolve('pnpm-lock.yaml');
let lockfile = readFileSync(lockfilePath, 'utf8');

const replacements = [
  [`supabase:\n        specifier: ^${SUPABASE_VERSION}\n        version: ${SUPABASE_VERSION}`, `supabase:\n        specifier: ${SUPABASE_VERSION}\n        version: ${SUPABASE_VERSION}`],
  [`'@playwright/test':\n        specifier: ^${PLAYWRIGHT_VERSION}\n        version: ${PLAYWRIGHT_VERSION}`, `'@playwright/test':\n        specifier: ${PLAYWRIGHT_VERSION}\n        version: ${PLAYWRIGHT_VERSION}`],
];

for (const [before, after] of replacements) {
  const occurrences = lockfile.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one lockfile occurrence for ${before.split('\n')[0]}, found ${occurrences}.`);
  }
  lockfile = lockfile.replace(before, after);
}

writeFileSync(lockfilePath, lockfile);
console.log(`Pinned Supabase CLI ${SUPABASE_VERSION} and Playwright ${PLAYWRIGHT_VERSION}.`);
