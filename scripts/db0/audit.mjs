#!/usr/bin/env node
// WP-DB0 — Database Reality Audit.
//
// Replays the repository migration chain into a clean PostgreSQL, introspects
// the resulting schema, parses the generated types, scans real frontend usage,
// and emits the contract drift register.
//
//   node scripts/db0/audit.mjs [--out DIR] [--quiet]

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ROOT, createDatabase, listMigrations, replay } from './lib/replay.mjs';
import { introspect } from './lib/introspect.mjs';
import { parseDatabaseTypes } from './lib/types-parse.mjs';
import { scanFrontend } from './lib/frontend-scan.mjs';
import { buildDrift, summarise, SEVERITY } from './lib/drift.mjs';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args[outIdx + 1] : join(ROOT, '.db0-artifacts');
const quiet = args.includes('--quiet');

await mkdir(OUT, { recursive: true });

const log = (...a) => !quiet && console.log(...a);

log('WP-DB0 Database Reality Audit');
log('='.repeat(70));

// 1. replay ------------------------------------------------------------------
const files = await listMigrations();
const db = await createDatabase();
const replayResult = await replay(db, { files, stopOnError: false });
log(`\n[1/5] Migration replay: ${replayResult.applied.length}/${files.length} applied, ${replayResult.failures.length} failed.`);
for (const f of replayResult.failures) log(`      FAIL ${f.file}: ${f.error}`);

// 2. introspect --------------------------------------------------------------
const schema = await introspect(db);
log(
  `[2/5] Schema inventory: ${schema.tables.length} tables, ${schema.columns.length} columns, ` +
    `${schema.views.length} views, ${schema.functions.length} functions, ${schema.enums.length} enums,`,
);
log(
  `      ${schema.foreign_keys.length} FKs, ${schema.constraints.length} constraints, ` +
    `${schema.triggers.length} triggers, ${schema.policies.length} policies, ${schema.indexes.length} indexes.`,
);

// 3. types -------------------------------------------------------------------
const types = await parseDatabaseTypes();
log(
  `[3/5] Generated types: ${Object.keys(types.tables).length} tables, ${Object.keys(types.views).length} views, ` +
    `${Object.keys(types.functions).length} functions, ${Object.keys(types.enums).length} enums.`,
);

// 4. frontend ----------------------------------------------------------------
const frontend = await scanFrontend();
log(
  `[4/5] Frontend usage: ${frontend.scannedFiles} files scanned, ` +
    `${frontend.relations.length} relations, ${frontend.rpcs.length} RPCs referenced.`,
);

// 5. drift -------------------------------------------------------------------
const findings = buildDrift({ schema, types, frontend });
const summary = summarise(findings);
log(`[5/5] Contract drift: ${summary.total} findings.`);
log('\nBy severity: ' + JSON.stringify(summary.bySeverity));
log('By class:');
for (const [id, n] of Object.entries(summary.byId).sort((a, b) => b[1] - a[1])) {
  log(`   ${id.padEnd(9)} ${String(n).padStart(4)}`);
}

await db.close();

// artifacts ------------------------------------------------------------------
const inventory = {
  generatedAt: new Date().toISOString(),
  migrations: { total: files.length, applied: replayResult.applied.length, failures: replayResult.failures },
  counts: {
    tables: schema.tables.length,
    columns: schema.columns.length,
    views: schema.views.length,
    functions: schema.functions.length,
    enums: schema.enums.length,
    foreignKeys: schema.foreign_keys.length,
    constraints: schema.constraints.length,
    triggers: schema.triggers.length,
    policies: schema.policies.length,
    indexes: schema.indexes.length,
  },
  schema,
};

await writeFile(join(OUT, 'inventory.json'), JSON.stringify(inventory, null, 2));
await writeFile(join(OUT, 'types.json'), JSON.stringify(types, null, 2));
await writeFile(join(OUT, 'frontend-usage.json'), JSON.stringify(frontend, null, 2));
await writeFile(
  join(OUT, 'drift.json'),
  JSON.stringify({ generatedAt: inventory.generatedAt, summary, findings }, null, 2),
);

log(`\nArtifacts written to ${OUT}`);

const blockers = findings.filter((f) => f.severity === SEVERITY.BLOCKER);
log(`\nBLOCKERS: ${blockers.length}`);
for (const b of blockers.slice(0, 40)) log(`  [${b.id}] ${b.title}`);
if (blockers.length > 40) log(`  ... and ${blockers.length - 40} more`);
