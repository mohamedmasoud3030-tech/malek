#!/usr/bin/env node
// MALEK Database Guardian — unified local gate.
//
// This runner composes the repository's existing DB0 proofs with the governance
// stabilization behavioral tests. It never contacts hosted Supabase and never
// mutates production data. The machine-readable report is written to
// .guardian/report.json and is intentionally gitignored.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const REPORT_PATH = join(ROOT, '.guardian', 'report.json');

const layers = [
  {
    id: 'db0-gate',
    title: 'Canonical schema replay / DB0 gate',
    cmd: ['node', ['scripts/db0/gate.mjs']],
  },
  {
    id: 'canonical-authority',
    title: 'Canonical membership authority + Auth Hook matrix',
    cmd: ['node', ['scripts/supabase-tests/canonical-authority-matrix.mjs']],
  },
  {
    id: 'sensitive-rpc-auth',
    title: 'Sensitive RPC role/company authorization matrix',
    cmd: ['node', ['scripts/supabase-tests/sensitive-rpc-authorization-matrix.mjs']],
  },
  {
    id: 'internal-gl-rpc-boundary',
    title: 'Internal GL posting/helper RPC browser EXECUTE boundary',
    cmd: ['node', ['scripts/supabase-tests/internal-gl-rpc-browser-boundary.mjs']],
  },
  {
    id: 'security-definer-governance',
    title: 'Effective SECURITY DEFINER governance audit',
    cmd: ['node', ['scripts/supabase-tests/security-definer-governance-audit.mjs']],
  },
  {
    id: 'security-definer-boundary',
    title: 'Internal SECURITY DEFINER execute-boundary audit',
    cmd: ['node', ['scripts/supabase-tests/security-definer-boundary-audit.mjs']],
  },
  {
    id: 'function-default-acl',
    title: 'Fail-closed default function EXECUTE audit',
    cmd: ['node', ['scripts/supabase-tests/function-default-acl-audit.mjs']],
  },
  {
    id: 'strict-governance',
    title: 'Guardian strict authority scan (DG-GOV-008)',
    cmd: ['node', ['scripts/guardian/governance.mjs']],
  },
  {
    id: 'governance-migration-safety',
    title: 'Clean + incremental governance migration safety',
    cmd: ['node', ['scripts/supabase-tests/governance-migration-safety.mjs']],
  },
  {
    id: 'migration-hygiene',
    title: 'Migration / rollback hygiene',
    cmd: ['node', ['scripts/check-migration-rollback-hygiene.mjs']],
  },
  {
    id: 'privileged-key-scan',
    title: 'Privileged key exposure scan',
    cmd: ['node', ['scripts/supabase-tests/privileged-key-scan.mjs']],
  },
];

function tail(output, count = 24) {
  return output.trim().split('\n').slice(-count).join('\n');
}

const results = [];
console.log('MALEK Database Guardian');
console.log('='.repeat(72));

for (const layer of layers) {
  const started = Date.now();
  console.log(`\n[${layer.id}] ${layer.title}`);
  const res = spawnSync(layer.cmd[0], layer.cmd[1], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, GUARDIAN: 'true', VITEST: 'true' },
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  process.stdout.write(output);
  const seconds = Number(((Date.now() - started) / 1000).toFixed(2));
  results.push({
    id: layer.id,
    title: layer.title,
    ok: res.status === 0,
    exitCode: res.status,
    signal: res.signal ?? null,
    seconds,
    tail: tail(output),
  });
}

const failed = results.filter((r) => !r.ok);
const report = {
  version: 3,
  generatedAt: new Date().toISOString(),
  environment: {
    hostedSupabaseTouched: false,
    productionDataTouched: false,
    runner: 'scripts/guardian/run.mjs',
  },
  summary: {
    layers: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    status: failed.length ? 'FAIL' : 'PASS',
  },
  layers: results,
};

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

console.log(`\n${'='.repeat(72)}`);
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.id.padEnd(28)} ${String(result.seconds).padStart(7)}s`);
}
console.log(`Report: ${REPORT_PATH}`);
console.log(failed.length ? `GUARDIAN: FAIL — ${failed.length} blocking layer(s).` : 'GUARDIAN: PASS — all blocking layers passed.');
process.exit(failed.length ? 1 : 0);
