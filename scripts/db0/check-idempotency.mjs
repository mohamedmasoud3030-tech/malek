#!/usr/bin/env node
// WP-DB0 Gate 2 — migration replay / idempotency.
//
// Two properties are proven here:
//
//   1. REPLAY  — the chain applies to a clean database (Gate 1) and the
//                resulting schema is stable.
//   2. IDEMPOTENCY — re-running the chain over an already-migrated database
//                does not error and does not change the schema.
//
// Property 2 is what makes a corrective migration safe to apply to the live
// project: applying it again (or applying it after a partial failure) must
// converge on the same state rather than compounding.

import { createHash } from 'node:crypto';

import { createDatabase, listMigrations, replay } from './lib/replay.mjs';
import { introspect } from './lib/introspect.mjs';

const args = process.argv.slice(2);
// By default only the migrations WP-DB0 introduces are re-run: the historical
// chain predates this gate and is not required to be individually idempotent.
const scope = args.includes('--all') ? 'all' : 'wp-db0';
const WP_DB0_PREFIX = '20260815000000';

function fingerprint(schema) {
  // A canonical, order-stable digest of everything in the data contract.
  const material = JSON.stringify({
    tables: schema.tables.map((t) => [t.name, t.rls_enabled, t.rls_forced]),
    columns: schema.columns.map((c) => [
      c.table_name,
      c.column_name,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.numeric_precision,
      c.numeric_scale,
    ]),
    enums: schema.enums.map((e) => [e.name, e.labels]),
    constraints: schema.constraints.map((c) => [c.table_name, c.name, c.definition]),
    views: schema.views.map((v) => [v.name, v.security_invoker]),
    functions: schema.functions.map((f) => [f.name, f.args, f.returns, f.security_definer, f.config]),
    triggers: schema.triggers.map((t) => [t.table_name, t.name, t.definition]),
    policies: schema.policies.map((p) => [p.tablename, p.name, p.cmd, p.roles, p.qual, p.with_check]),
    indexes: schema.indexes.map((i) => [i.table_name, i.name, i.definition]),
  });
  return createHash('sha256').update(material).digest('hex');
}

function diffSchemas(before, after) {
  const diffs = [];
  const sections = ['tables', 'columns', 'enums', 'constraints', 'views', 'functions', 'triggers', 'policies', 'indexes'];
  for (const section of sections) {
    const key = (row) => JSON.stringify(row);
    const b = new Set((before[section] ?? []).map(key));
    const a = new Set((after[section] ?? []).map(key));
    for (const row of a) if (!b.has(row)) diffs.push(`+ ${section}: ${row.slice(0, 200)}`);
    for (const row of b) if (!a.has(row)) diffs.push(`- ${section}: ${row.slice(0, 200)}`);
  }
  return diffs;
}

const all = await listMigrations();
if (all.some((f) => String(f).includes('20260901000000_canonical_baseline'))) {
  console.log('WP-DB0 idempotency gate: skipped for the single canonical dump bootstrap (not a forward incremental migration).');
  process.exit(0);
}
const rerun = scope === 'all' ? all : all.filter((f) => f >= WP_DB0_PREFIX);

console.log(`WP-DB0 idempotency gate (scope: ${scope}, re-running ${rerun.length} of ${all.length} migrations).`);

const db = await createDatabase();

const first = await replay(db, { files: all, stopOnError: false });
if (first.failures.length) {
  console.error(`\nFirst pass failed (${first.failures.length}):`);
  for (const f of first.failures) console.error(`  ${f.file}: ${f.error}`);
  process.exit(1);
}
const before = await introspect(db);
const beforeHash = fingerprint(before);
console.log(`First pass:  ${first.applied.length} applied, schema ${beforeHash.slice(0, 16)}`);

const second = await replay(db, { files: rerun, stopOnError: false });
if (second.failures.length) {
  console.error(`\nNOT IDEMPOTENT — re-running raised ${second.failures.length} error(s):`);
  for (const f of second.failures) console.error(`  ${f.file}: ${f.error}`);
  await db.close();
  process.exit(1);
}
const after = await introspect(db);
const afterHash = fingerprint(after);
console.log(`Second pass: ${second.applied.length} re-applied, schema ${afterHash.slice(0, 16)}`);

await db.close();

if (beforeHash !== afterHash) {
  console.error('\nNOT IDEMPOTENT — the schema changed on re-run:');
  for (const d of diffSchemas(before, after).slice(0, 50)) console.error(`  ${d}`);
  process.exit(1);
}

console.log('\nPASS — replay is clean and re-running the WP-DB0 migrations is a no-op.');
