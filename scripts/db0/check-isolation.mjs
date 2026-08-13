#!/usr/bin/env node
// WP-DB0 Gate 3 — RLS / company isolation and FK integrity.
//
// Structural gate over the replayed schema. It asserts the invariants that make
// multi-tenancy safe, so a future migration cannot quietly drop them:
//
//   * every company-scoped table has RLS enabled
//   * every company-scoped table has at least one policy
//   * every company-scoped policy is actually company-aware (or denies all)
//   * every company_id is anchored by a foreign key
//   * every SECURITY DEFINER function pins search_path
//   * every view runs with security_invoker
//   * no policy grants access to the anon role on a tenant table

import { createDatabase, replay } from './lib/replay.mjs';
import { introspect } from './lib/introspect.mjs';
import { findIsolationViolations } from './lib/isolation.mjs';

const db = await createDatabase();
const { failures } = await replay(db, { stopOnError: false });
if (failures.length) {
  console.error(`Migration replay failed (${failures.length}).`);
  for (const f of failures) console.error(`  ${f.file}: ${f.error}`);
  process.exit(2);
}
const schema = await introspect(db);
await db.close();

const { tenantTables, violations } = findIsolationViolations(schema);

console.log('WP-DB0 isolation gate');
console.log('='.repeat(60));
console.log(`Tenant tables checked : ${tenantTables.length}`);
console.log(`Policies checked      : ${schema.policies.length}`);
console.log(`Functions checked     : ${schema.functions.length}`);
console.log(`Views checked         : ${schema.views.length}`);

if (!violations.length) {
  console.log('\nPASS — no isolation violations.');
  process.exit(0);
}

const byRule = {};
for (const v of violations) (byRule[v.rule] ??= []).push(v.detail);
console.log(`\nFAIL — ${violations.length} violation(s):`);
for (const [rule, details] of Object.entries(byRule)) {
  console.log(`\n  ${rule} (${details.length})`);
  for (const d of details) console.log(`    - ${d}`);
}
process.exit(1);
