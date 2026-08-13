#!/usr/bin/env node
// WP-DB0 Gate 1 — migration chain from a clean database.
//
// Usage:
//   node scripts/db0/replay-migrations.mjs            # stop at first failure
//   node scripts/db0/replay-migrations.mjs --all      # keep going, list every failure
//   node scripts/db0/replay-migrations.mjs --json out.json

import { writeFile } from 'node:fs/promises';

import { createDatabase, listMigrations, replay } from './lib/replay.mjs';

const args = process.argv.slice(2);
const stopOnError = !args.includes('--all');
const jsonIdx = args.indexOf('--json');
const jsonOut = jsonIdx >= 0 ? args[jsonIdx + 1] : null;
const quiet = args.includes('--quiet');

const files = await listMigrations();
console.log(`WP-DB0 replay: ${files.length} migrations, clean database, PGlite (PostgreSQL 18).`);

const db = await createDatabase();
const started = Date.now();

const result = await replay(db, {
  files,
  stopOnError,
  onProgress: ({ file, ok, error }) => {
    if (ok) {
      if (!quiet) console.log(`  ok   ${file}`);
    } else {
      console.log(`  FAIL ${file}\n         ${error}`);
    }
  },
});

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `\nApplied ${result.applied.length}/${files.length} in ${seconds}s. Failures: ${result.failures.length}.`,
);

if (result.shimmed.length) {
  console.log(
    `Platform-dependent migrations (managed extensions, exception-guarded): ${result.shimmed.length}`,
  );
}

if (result.failures.length) {
  console.log('\nFailures:');
  for (const f of result.failures) {
    console.log(`  - ${f.file}`);
    console.log(`      ${f.error}`);
    if (f.detail) console.log(`      detail: ${f.detail}`);
    if (f.hint) console.log(`      hint: ${f.hint}`);
  }
}

if (jsonOut) {
  await writeFile(jsonOut, JSON.stringify({ total: files.length, ...result }, null, 2));
  console.log(`\nWrote ${jsonOut}`);
}

await db.close();
process.exit(result.failures.length ? 1 : 0);
