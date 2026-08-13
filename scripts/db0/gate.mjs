#!/usr/bin/env node
// WP-DB0 — Database Integrity Gates.
//
// Runs every database-contract gate in dependency order and prints one
// summary. This is the command CI runs and the command that decides whether
// the WP-DB0 exit criteria are met.
//
//   node scripts/db0/gate.mjs

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const GATES = [
  {
    id: 'migration-chain',
    title: 'Migration chain from a clean database',
    cmd: ['node', [join(HERE, 'replay-migrations.mjs'), '--all', '--quiet']],
  },
  {
    id: 'idempotency',
    title: 'Migration replay / idempotency',
    cmd: ['node', [join(HERE, 'check-idempotency.mjs')]],
  },
  {
    id: 'schema-type-drift',
    title: 'Schema/type drift (generated types match the migrations)',
    cmd: ['node', [join(HERE, 'gen-types.mjs'), '--check']],
  },
  {
    id: 'contract',
    title: 'Frontend/service/RPC contract drift',
    cmd: ['node', [join(HERE, 'check-contract.mjs')]],
  },
  {
    id: 'isolation',
    title: 'RLS / company isolation and FK integrity',
    cmd: ['node', [join(HERE, 'check-isolation.mjs')]],
  },
  {
    id: 'role-model',
    title: 'Six-role authorization is physically representable',
    cmd: ['node', [join(HERE, 'probe-role-enum.mjs')]],
  },
];

const results = [];
for (const gate of GATES) {
  process.stdout.write(`\n${'='.repeat(70)}\n[${gate.id}] ${gate.title}\n${'='.repeat(70)}\n`);
  const started = Date.now();
  const res = spawnSync(gate.cmd[0], gate.cmd[1], { cwd: ROOT, stdio: 'inherit' });
  results.push({
    ...gate,
    ok: res.status === 0,
    status: res.status,
    seconds: ((Date.now() - started) / 1000).toFixed(1),
  });
}

console.log(`\n${'='.repeat(70)}\nWP-DB0 DATABASE INTEGRITY GATES\n${'='.repeat(70)}`);
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(20)} ${r.seconds}s  ${r.title}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} gates passed.`);
process.exit(failed.length ? 1 : 0);
