import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Feature-flag cleanup guard.
 *
 * The browser evaluator and this Node release guard share one canonical source:
 * rentrix-app/src/lib/feature-flag-definitions.json
 */

const definitionsUrl = new URL('../rentrix-app/src/lib/feature-flag-definitions.json', import.meta.url);
const definitionsPath = fileURLToPath(definitionsUrl);
const flags = JSON.parse(readFileSync(definitionsPath, 'utf8'));
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const today = new Date().toISOString().slice(0, 10);

let exitCode = 0;

if (!Array.isArray(flags) || flags.length === 0) {
  console.error('❌ Feature-flag inventory is missing or empty.');
  process.exit(1);
}

for (const flag of flags) {
  if (!flag || typeof flag.key !== 'string' || flag.key.length === 0) {
    console.error('❌ Feature-flag definition has no valid key.');
    exitCode = 1;
    continue;
  }

  if ((flag.phase === 'alpha' || flag.phase === 'beta') && !DATE_ONLY.test(flag.cleanupBy ?? '')) {
    console.error(`❌ Flag "${flag.key}" (${flag.phase}) must have cleanupBy in YYYY-MM-DD format.`);
    exitCode = 1;
    continue;
  }

  if (typeof flag.cleanupBy !== 'string' || !DATE_ONLY.test(flag.cleanupBy)) continue;

  const parsed = Date.parse(`${flag.cleanupBy}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    console.error(`❌ Flag "${flag.key}" has invalid cleanupBy: ${flag.cleanupBy}.`);
    exitCode = 1;
    continue;
  }

  if (flag.cleanupBy <= today) {
    console.error(`❌ Flag "${flag.key}" expired on ${flag.cleanupBy}. Remove or explicitly extend it.`);
    exitCode = 1;
  }
}

if (exitCode === 0) {
  console.log(`✅ ${flags.length} feature flags are within their cleanup windows (${today}).`);
}

process.exit(exitCode);
