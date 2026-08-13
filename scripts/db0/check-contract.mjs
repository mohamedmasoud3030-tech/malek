#!/usr/bin/env node
// WP-DB0 Gate 4 — contract drift guard.
//
// Fails when the four contract layers disagree in a way that is a defect:
// frontend expecting a missing column/relation/RPC, types out of step with the
// schema, or an RPC signature mismatch.
//
// The financial-precision class (DB0-07) is reported but does not fail the
// gate: it is the pre-existing GAP-009 conflict, owned by WP-02, and requires
// an accounting-approved data conversion rather than a silent type change.
// Its count is pinned so the number can only go DOWN.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ROOT, createDatabase, replay } from './lib/replay.mjs';
import { introspect } from './lib/introspect.mjs';
import { parseDatabaseTypes } from './lib/types-parse.mjs';
import { scanFrontend } from './lib/frontend-scan.mjs';
import { buildDrift, summarise, SEVERITY } from './lib/drift.mjs';

const BASELINE_PATH = join(ROOT, 'scripts', 'db0', 'contract-baseline.json');

const db = await createDatabase();
const { failures } = await replay(db, { stopOnError: false });
if (failures.length) {
  console.error(`Migration replay failed (${failures.length}):`);
  for (const f of failures) console.error(`  ${f.file}: ${f.error}`);
  process.exit(2);
}
const schema = await introspect(db);
await db.close();

const types = await parseDatabaseTypes();
const frontend = await scanFrontend();
const findings = buildDrift({ schema, types, frontend });
const summary = summarise(findings);

const baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'));

console.log('WP-DB0 contract gate');
console.log('='.repeat(60));
console.log(`Findings: ${summary.total}`);
for (const [id, n] of Object.entries(summary.byId).sort((a, b) => b[1] - a[1])) {
  const allowed = baseline.accepted[id] ?? 0;
  const flag = n > allowed ? ' <-- OVER BASELINE' : '';
  console.log(`  ${id.padEnd(9)} ${String(n).padStart(4)}   (accepted ${allowed})${flag}`);
}

const errors = [];

// 1. Nothing may regress past the accepted baseline.
for (const [id, n] of Object.entries(summary.byId)) {
  const allowed = baseline.accepted[id] ?? 0;
  if (n > allowed) {
    errors.push(`${id}: ${n} findings, baseline allows ${allowed}`);
    for (const f of findings.filter((x) => x.id === id).slice(0, 10)) {
      errors.push(`    - ${f.title}`);
    }
  }
}

// 2. No blocker is ever acceptable.
const blockers = findings.filter((f) => f.severity === SEVERITY.BLOCKER);
for (const b of blockers) errors.push(`BLOCKER ${b.id}: ${b.title}`);

if (errors.length) {
  console.log(`\nFAIL — contract drift detected:`);
  for (const e of errors) console.log(`  ${e}`);
  console.log(
    '\nIf this change intentionally alters the data contract, regenerate types\n' +
      '(`pnpm db0:gen-types`) and, only with an explicit contract decision,\n' +
      'update scripts/db0/contract-baseline.json.',
  );
  process.exit(1);
}

console.log('\nPASS — no new contract drift.');
